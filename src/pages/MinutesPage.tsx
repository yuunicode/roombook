import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState, type AppReservation, type AppUser } from '../stores';
import AppIcon from '../components/ui/AppIcon';
import {
  acquireMinutesLock as acquireMinutesLockApi,
  getMinutesLock as getMinutesLockApi,
  releaseMinutesLock as releaseMinutesLockApi,
  type MinutesLockDto,
} from '../api';

type MinutesDraft = {
  label: string;
  title: string;
  dateInput: string;
  startTimeInput: string;
  endTimeInput: string;
  externalAttendees: string;
  agenda: string;
  meetingContent: string;
  meetingResult: string;
};

type MinutesField = 'agenda' | 'meetingContent' | 'meetingResult';

type EditLock = {
  holderUserId: string;
  holderName: string;
  updatedAt: number;
};

const LOCK_HEARTBEAT_MS = 3000;
const LIVE_SYNC_MS = 5000;
const MAX_UNDO_HISTORY = 100;
const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;

function getBulletPrefix(level: number) {
  const normalized = Math.max(0, Math.min(level, BULLET_SYMBOLS.length - 1));
  return `${BULLET_SYMBOLS[normalized]} `;
}

function toMarkdownFilename(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]/g, '-');
  return normalized || 'meeting-minutes';
}

function formatDateToken(dateInput: string, fallbackDate: Date) {
  if (dateInput) {
    const [yyyy, mm, dd] = dateInput.split('-');
    if (yyyy && mm && dd) return `${yyyy}${mm}${dd}`;
  }
  return format(fallbackDate, 'yyyyMMdd');
}

function MinutesPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const {
    userEmail,
    users,
    reservations,
    reservationLabels,
    saveReservationMinutes,
    getReservationMinutes,
  } = useAppState();

  const reservation = useMemo(
    () => (reservationId ? (reservations.find((item) => item.id === reservationId) ?? null) : null),
    [reservationId, reservations]
  );
  const [minutesReservation, setMinutesReservation] = useState<AppReservation | null>(null);
  const activeReservation = minutesReservation ?? reservation;

  const [draft, setDraft] = useState<MinutesDraft>({
    label: '',
    title: '',
    dateInput: '',
    startTimeInput: '',
    endTimeInput: '',
    externalAttendees: '',
    agenda: '',
    meetingContent: '',
    meetingResult: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeLock, setActiveLock] = useState<EditLock | null>(null);
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);
  const historyRef = useRef<MinutesDraft[]>([]);
  const lastSavedKeyRef = useRef('');
  const isSavingRef = useRef(false);

  const agendaRef = useRef<HTMLTextAreaElement>(null);
  const meetingContentRef = useRef<HTMLTextAreaElement>(null);
  const meetingResultRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const currentUser = useMemo(
    () => users.find((item) => item.email.toLowerCase() === userEmail.toLowerCase()) ?? null,
    [users, userEmail]
  );
  const viewerId = currentUser?.id ?? '';

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  const toEditLock = useCallback((item: MinutesLockDto): EditLock => {
    return {
      holderUserId: item.holder_user_id,
      holderName: item.holder_name,
      updatedAt: new Date(item.expires_at).getTime(),
    };
  }, []);

  const readLock = useCallback(async (): Promise<EditLock | null> => {
    if (!reservationId) return null;
    const result = await getMinutesLockApi(reservationId);
    if (!result) return null;
    return toEditLock(result);
  }, [reservationId, toEditLock]);

  const releaseLock = useCallback(async () => {
    if (!reservationId) return;
    try {
      await releaseMinutesLockApi(reservationId);
    } finally {
      setActiveLock(null);
    }
  }, [reservationId]);

  const acquireLock = useCallback(async () => {
    if (!reservationId) return false;
    try {
      const result = await acquireMinutesLockApi(reservationId, 15);
      setActiveLock(toEditLock(result));
      return true;
    } catch {
      const current = await readLock();
      setActiveLock(current);
      return false;
    }
  }, [readLock, reservationId, toEditLock]);

  useEffect(() => {
    if (!activeReservation || isEditing) {
      return;
    }

    const nextDraft: MinutesDraft = {
      label: activeReservation.label ?? reservationLabels[0] ?? '',
      title: activeReservation.title ?? '',
      dateInput: format(activeReservation.start, 'yyyy-MM-dd'),
      startTimeInput: format(activeReservation.start, 'HH:mm'),
      endTimeInput: format(activeReservation.end, 'HH:mm'),
      externalAttendees: activeReservation.externalAttendees ?? '',
      agenda: activeReservation.agenda ?? '',
      meetingContent: activeReservation.meetingContent ?? '',
      meetingResult: activeReservation.meetingResult ?? '',
    };

    setDraft(nextDraft);
    setSelectedAttendees(activeReservation.attendees ?? []);
    setAttendeeQuery('');
    historyRef.current = [];
    setSaveMessage('');
    lastSavedKeyRef.current = JSON.stringify({
      draft: nextDraft,
      attendees: (activeReservation.attendees ?? []).map((attendee) => attendee.id),
    });
  }, [activeReservation, reservationLabels, isEditing]);

  useEffect(() => {
    resizeTextarea(agendaRef.current);
  }, [draft.agenda]);

  useEffect(() => {
    resizeTextarea(titleRef.current);
  }, [draft.title]);

  useEffect(() => {
    resizeTextarea(meetingContentRef.current);
  }, [draft.meetingContent]);

  useEffect(() => {
    resizeTextarea(meetingResultRef.current);
  }, [draft.meetingResult]);

  useEffect(() => {
    if (!isEditing) return;
    const heartbeat = window.setInterval(() => {
      void (async () => {
        if (!reservationId) return;
        try {
          const result = await acquireMinutesLockApi(reservationId, 15);
          setActiveLock(toEditLock(result));
        } catch {
          setIsEditing(false);
        }
      })();
    }, LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(heartbeat);
  }, [isEditing, reservationId, toEditLock]);

  useEffect(() => {
    const handlePageHide = () => {
      if (isEditing) {
        void releaseLock();
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      void releaseLock();
    };
  }, [isEditing, releaseLock]);

  const pushHistory = useCallback((snapshot: MinutesDraft) => {
    historyRef.current = [...historyRef.current, snapshot].slice(-MAX_UNDO_HISTORY);
  }, []);

  const updateDraft = useCallback(
    (patch: Partial<MinutesDraft>) => {
      if (!isEditing) return;
      setDraft((prev) => {
        pushHistory(prev);
        return { ...prev, ...patch };
      });
      setSaveMessage('저장 전');
    },
    [isEditing, pushHistory]
  );

  const setFieldValueWithCursor = useCallback(
    (
      field: MinutesField,
      nextValue: string,
      cursorStart: number,
      cursorEnd: number,
      textarea: HTMLTextAreaElement
    ) => {
      updateDraft({ [field]: nextValue } as Pick<MinutesDraft, MinutesField>);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [updateDraft]
  );

  const handleEditorKeyDown = useCallback(
    (field: MinutesField) => (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!isEditing) return;

      const textarea = event.currentTarget;
      const value = textarea.value;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;

      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const nextLineBreakIndex = value.indexOf('\n', selectionStart);
      const lineEnd = nextLineBreakIndex === -1 ? value.length : nextLineBreakIndex;
      const line = value.slice(lineStart, lineEnd);
      const lineBeforeCursor = value.slice(lineStart, selectionStart);

      if (event.key === '-') {
        if (selectionStart !== selectionEnd) return;
        if (!/^\t*$/.test(lineBeforeCursor)) return;
        event.preventDefault();
        const indentLevel = Math.min(lineBeforeCursor.length, MAX_BULLET_LEVEL - 1);
        const bullet = getBulletPrefix(indentLevel);
        const nextValue = `${value.slice(0, selectionStart)}${bullet}${value.slice(selectionEnd)}`;
        const nextCursor = selectionStart + bullet.length;
        setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
        return;
      }

      if (event.key === 'Enter') {
        const bulletMatch = line.match(BULLET_PATTERN);
        if (!bulletMatch) return;
        event.preventDefault();
        const indent = bulletMatch[1] ?? '';
        const insert = `\n${indent}${getBulletPrefix(indent.length)}`;
        const nextValue = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
        const nextCursor = selectionStart + insert.length;
        setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();

        if (event.shiftKey) {
          const indentMatch = line.match(/^(\t{1,3})([•◦▪▫])\s?(.*)$/);
          if (indentMatch) {
            const nextIndent = indentMatch[1].slice(0, -1);
            const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${indentMatch[3]}`;
            const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
            const nextCursor = Math.max(lineStart, selectionStart - 1);
            setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
            return;
          }

          const bulletMatch = line.match(/^([•◦▪▫])\s?(.*)$/);
          if (bulletMatch) {
            const nextLine = bulletMatch[2];
            const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
            const nextCursor = Math.max(lineStart, selectionStart - 2);
            setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
          }
          return;
        }

        const nestedMatch = line.match(BULLET_PATTERN);
        if (nestedMatch) {
          const nextIndent = `${nestedMatch[1]}\t`;
          if (nextIndent.length >= MAX_BULLET_LEVEL) return;
          const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${nestedMatch[3]}`;
          const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
          const nextCursor = selectionStart + 1;
          setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
          return;
        }

        const plainLineMatch = line.match(/^(\t{0,4})(.*)$/);
        if (plainLineMatch) {
          const indent = plainLineMatch[1].slice(0, MAX_BULLET_LEVEL - 1);
          const bullet = getBulletPrefix(indent.length);
          const nextLine = `${indent}${bullet}${plainLineMatch[2]}`;
          const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
          const nextCursor = selectionStart + bullet.length;
          setFieldValueWithCursor(field, nextValue, nextCursor, nextCursor, textarea);
        }
      }
    },
    [isEditing, setFieldValueWithCursor]
  );

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) return [];

    const candidates = users.filter(
      (user) => !selectedAttendees.some((attendee) => attendee.id === user.id)
    );

    const startsWithName = candidates.filter((user) => user.name.toLowerCase().startsWith(keyword));
    const includesName = candidates.filter(
      (user) =>
        !user.name.toLowerCase().startsWith(keyword) && user.name.toLowerCase().includes(keyword)
    );
    const includesEmail = candidates.filter(
      (user) =>
        !user.name.toLowerCase().includes(keyword) && user.email.toLowerCase().includes(keyword)
    );

    return [...startsWithName, ...includesName, ...includesEmail].slice(0, 6);
  }, [attendeeQuery, selectedAttendees, users]);

  const handleUndo = useCallback(() => {
    if (!isEditing) return;
    const history = historyRef.current;
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    historyRef.current = history.slice(0, -1);
    setDraft(previous);
    setSaveMessage('실행 취소되었습니다.');
  }, [isEditing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
      if (!isUndo) return;
      if (!isEditing || historyRef.current.length === 0) return;
      event.preventDefault();
      handleUndo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleUndo]);

  const persistDraft = useCallback(
    async (notice: 'silent' | 'saved' | 'completed' = 'saved') => {
      if (!activeReservation || !isEditing || isSavingRef.current) return false;
      if (!draft.title.trim() || !draft.dateInput || !draft.startTimeInput || !draft.endTimeInput) {
        if (notice !== 'silent') setSaveMessage('필수 항목을 먼저 입력하세요.');
        return false;
      }

      const nextStart = new Date(`${draft.dateInput}T${draft.startTimeInput}`);
      const nextEnd = new Date(`${draft.dateInput}T${draft.endTimeInput}`);
      if (
        Number.isNaN(nextStart.getTime()) ||
        Number.isNaN(nextEnd.getTime()) ||
        nextEnd <= nextStart
      ) {
        if (notice !== 'silent') setSaveMessage('날짜/시간이 올바르지 않습니다.');
        return false;
      }

      const currentKey = JSON.stringify({
        draft,
        attendees: selectedAttendees.map((attendee) => attendee.id),
      });
      if (currentKey === lastSavedKeyRef.current) return true;

      isSavingRef.current = true;
      try {
        const updated = await saveReservationMinutes(activeReservation.id, {
          title: draft.title,
          label: draft.label,
          start: nextStart,
          end: nextEnd,
          attendees: selectedAttendees,
          externalAttendees: draft.externalAttendees,
          agenda: draft.agenda,
          meetingContent: draft.meetingContent,
          meetingResult: draft.meetingResult,
          minutesAttachment: activeReservation.minutesAttachment,
        });
        setMinutesReservation(updated);
        lastSavedKeyRef.current = currentKey;
        if (notice === 'saved') setSaveMessage('자동 저장되었습니다.');
        if (notice === 'completed') setSaveMessage('수정완료되었습니다.');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
        setSaveMessage(message);
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [activeReservation, draft, isEditing, saveReservationMinutes, selectedAttendees]
  );

  const internalAttendeeText = selectedAttendees.map((attendee) => attendee.name).join(', ');
  const lockByOther = Boolean(activeLock && activeLock.holderUserId !== viewerId);
  const lockTooltip = lockByOther ? `${activeLock?.holderName}가 수정하고있습니다.` : '';

  useEffect(() => {
    if (!reservationId) return;
    const sync = () => {
      void (async () => {
        if (isEditing) return;
        const result = await getReservationMinutes(reservationId);
        if (!result) return;
        setMinutesReservation(result);
      })();
    };
    sync();
    const intervalId = window.setInterval(sync, LIVE_SYNC_MS);
    return () => window.clearInterval(intervalId);
  }, [getReservationMinutes, isEditing, reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    if (isEditing) return;
    const syncLock = () => {
      void (async () => {
        const lock = await readLock();
        setActiveLock(lock);
      })();
    };
    syncLock();
    const intervalId = window.setInterval(syncLock, LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(intervalId);
  }, [isEditing, readLock, reservationId]);

  useEffect(() => {
    if (!isEditing) return;
    const intervalId = window.setInterval(() => {
      void persistDraft('silent');
    }, LIVE_SYNC_MS);
    return () => window.clearInterval(intervalId);
  }, [isEditing, persistDraft]);

  const handleEditToggle = () => {
    if (isEditing) {
      void (async () => {
        const saved = await persistDraft('completed');
        if (!saved) return;
        setIsEditing(false);
        await releaseLock();
      })();
      return;
    }
    void (async () => {
      const acquired = await acquireLock();
      if (!acquired) return;
      setIsEditing(true);
      setSaveMessage('수정 중입니다.');
    })();
  };

  const handleDownloadMarkdown = () => {
    if (!activeReservation) return;
    const dateToken = formatDateToken(draft.dateInput, activeReservation.start);
    const baseName = `${dateToken}_${toMarkdownFilename(draft.title)}`;

    const markdown = [
      `# ${draft.title || '회의록 제목'}`,
      '',
      `- 라벨: ${draft.label || '-'}`,
      `- 날짜: ${draft.dateInput || '-'}`,
      `- 시간: ${draft.startTimeInput || '-'} ~ ${draft.endTimeInput || '-'}`,
      `- 내부 참석자: ${internalAttendeeText || '없음'}`,
      `- 외부 참석자: ${draft.externalAttendees || '없음'}`,
      '',
      '## 🧭 주요 안건',
      draft.agenda || '',
      '',
      '## 📝 회의 내용',
      draft.meetingContent || '',
      '',
      '## ✅ 회의 결과',
      draft.meetingResult || '',
      '',
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!activeReservation) return;
    const dateToken = formatDateToken(draft.dateInput, activeReservation.start);
    const baseName = `${dateToken}_${toMarkdownFilename(draft.title)}`;
    const source = document.getElementById('minutes-page-export-root');
    if (!source) return;

    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!popup) {
      setSaveMessage('PDF 저장 창을 열 수 없습니다. 팝업 차단을 확인하세요.');
      return;
    }
    const copiedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>${baseName}.pdf</title>
          ${copiedStyles}
          <style>
            body { margin: 0; background: #fff; }
            #minutes-page-export-root { max-width: 960px; margin: 0 auto; padding: 24px 0 40px; }
          </style>
        </head>
        <body>${source.outerHTML}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.onload = () => {
      popup.print();
      popup.close();
    };
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/timetable');
  };

  if (!reservationId) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">회의록을 연결할 예약을 선택하세요</h2>
        <p className="page-subtitle">예약 카드의 [회의록 수정] 또는 Wiki의 [보기]로 이동하세요.</p>
      </div>
    );
  }

  if (!activeReservation) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">예약 정보를 찾을 수 없습니다</h2>
        <p className="page-subtitle">삭제되었거나 잘못된 접근입니다.</p>
      </div>
    );
  }

  return (
    <div
      id="minutes-page-export-root"
      style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 0 40px' }}
    >
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={draft.label}
            onChange={(e) => updateDraft({ label: e.target.value })}
            disabled={!isEditing}
            aria-label="라벨 선택"
            style={{
              height: '28px',
              minWidth: '110px',
              maxWidth: '140px',
              padding: '0 8px',
              borderRadius: '8px',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              background: 'rgba(16, 18, 24, 0.06)',
              color: '#6b563e',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            {reservationLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          {lockByOther && (
            <p className="status-info-value" style={{ color: '#d92d20', margin: 0 }}>
              {activeLock?.holderName}가 수정중입니다.
            </p>
          )}
          {!lockByOther && saveMessage && (
            <p
              className="status-info-value"
              style={{
                color:
                  saveMessage.includes('실패') ||
                  saveMessage.includes('올바르지') ||
                  saveMessage.includes('필수')
                    ? '#d92d20'
                    : '#18794e',
                margin: 0,
              }}
            >
              {saveMessage}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className="page-mode-button"
            type="button"
            onClick={handleDownloadMarkdown}
            aria-label="마크다운 저장"
            title="마크다운 저장"
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(16, 18, 24, 0.08)',
              color: '#6b563e',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              borderRadius: '8px',
              width: 'auto',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 10px',
              fontSize: '12px',
            }}
          >
            <AppIcon name="download" style={{ width: '14px', height: '14px' }} />
            마크다운 저장
          </button>
          <button
            className="page-mode-button"
            type="button"
            onClick={handleDownloadPdf}
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(16, 18, 24, 0.08)',
              color: '#6b563e',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              borderRadius: '8px',
              padding: '0 10px',
              height: '28px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="download" style={{ width: '14px', height: '14px' }} />
            PDF 저장
          </button>
          <button
            className="page-mode-button"
            type="button"
            onClick={handleEditToggle}
            disabled={lockByOther && !isEditing}
            title={lockTooltip}
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(16, 18, 24, 0.08)',
              color: '#6b563e',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              borderRadius: '8px',
              padding: '0 10px',
              height: '28px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {isEditing ? '수정완료' : '수정'}
          </button>
          <button
            className="page-mode-button"
            type="button"
            onClick={handleGoBack}
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(16, 18, 24, 0.08)',
              color: '#6b563e',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              borderRadius: '8px',
              padding: '0 10px',
              height: '28px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            돌아가기
          </button>
        </div>
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <textarea
          ref={titleRef}
          className="minutes-textarea"
          rows={1}
          value={draft.title}
          onChange={(e) => updateDraft({ title: e.target.value })}
          disabled={!isEditing}
          placeholder="회의록 제목"
          style={{
            minHeight: '44px',
            width: '100%',
            padding: '10px 12px',
            fontSize: '24px',
            fontWeight: 700,
            lineHeight: 1.35,
            resize: 'none',
            overflow: 'hidden',
            borderRadius: '8px',
            background: '#fcfcfd',
            border: '1px solid #e7e1da',
            marginBottom: '18px',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <div className="status-info-group">
            <label className="status-info-label">날짜</label>
            <input
              className="linear-input"
              type="date"
              value={draft.dateInput}
              onChange={(e) => updateDraft({ dateInput: e.target.value })}
              disabled
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">시작 시간</label>
            <input
              className="linear-input"
              type="time"
              value={draft.startTimeInput}
              onChange={(e) => updateDraft({ startTimeInput: e.target.value })}
              disabled
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">종료 시간</label>
            <input
              className="linear-input"
              type="time"
              value={draft.endTimeInput}
              onChange={(e) => updateDraft({ endTimeInput: e.target.value })}
              disabled
            />
          </div>
        </div>

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <label className="status-info-label">내부 참석자</label>
          <div className="attendee-token-input">
            {selectedAttendees.map((attendee) => (
              <span
                key={attendee.id}
                className="room-capacity-tag"
                style={{ cursor: isEditing ? 'pointer' : 'default' }}
                onClick={() => {
                  if (!isEditing) return;
                  setSelectedAttendees((prev) => prev.filter((item) => item.id !== attendee.id));
                }}
              >
                {attendee.name}
                {isEditing ? ' ✕' : ''}
              </span>
            ))}
            <input
              className="attendee-token-field"
              value={attendeeQuery}
              placeholder={selectedAttendees.length === 0 ? '이름 입력...' : ''}
              onChange={(e) => setAttendeeQuery(e.target.value)}
              disabled={!isEditing}
            />
          </div>
          {isEditing && filteredUsers.length > 0 && (
            <div
              className="user-dropdown-popover"
              style={{
                position: 'static',
                width: '100%',
                marginTop: '8px',
                boxShadow: 'none',
                border: '1px solid var(--border)',
              }}
            >
              {filteredUsers.slice(0, 4).map((user) => (
                <button
                  key={user.id}
                  className="popover-item"
                  onClick={() => {
                    setSelectedAttendees((prev) => [...prev, user]);
                    setAttendeeQuery('');
                  }}
                >
                  {user.name} ({user.email})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="status-info-group" style={{ marginBottom: '8px' }}>
          <label className="status-info-label">외부 참석자</label>
          <input
            className="linear-input"
            value={draft.externalAttendees}
            onChange={(e) => updateDraft({ externalAttendees: e.target.value })}
            disabled={!isEditing}
          />
        </div>

        <div style={{ borderTop: '1px dashed var(--border)', margin: '18px 0' }} />

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#6c4f2f',
              marginBottom: '8px',
              background: '#fff1d6',
              border: '1px solid #f2ddb2',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            🧭 주요 안건
          </div>
          <textarea
            ref={agendaRef}
            className="minutes-textarea"
            style={{
              minHeight: '120px',
              padding: '14px',
              fontSize: '15px',
              resize: 'none',
              overflow: 'hidden',
              borderRadius: '8px',
            }}
            value={draft.agenda}
            onChange={(e) => updateDraft({ agenda: e.target.value })}
            onKeyDown={handleEditorKeyDown('agenda')}
            disabled={!isEditing}
          />
        </div>

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#2d5870',
              marginBottom: '8px',
              background: '#e8f4ff',
              border: '1px solid #cfe4f6',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            📝 회의 내용
          </div>
          <textarea
            ref={meetingContentRef}
            className="minutes-textarea"
            style={{
              minHeight: '180px',
              padding: '14px',
              fontSize: '15px',
              resize: 'none',
              overflow: 'hidden',
              borderRadius: '8px',
            }}
            value={draft.meetingContent}
            onChange={(e) => updateDraft({ meetingContent: e.target.value })}
            onKeyDown={handleEditorKeyDown('meetingContent')}
            disabled={!isEditing}
          />
        </div>

        <div className="status-info-group">
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#355f3b',
              marginBottom: '8px',
              background: '#ebf8e6',
              border: '1px solid #d0e8c6',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            ✅ 회의 결과
          </div>
          <textarea
            ref={meetingResultRef}
            className="minutes-textarea"
            style={{
              minHeight: '140px',
              padding: '14px',
              fontSize: '15px',
              resize: 'none',
              overflow: 'hidden',
              borderRadius: '8px',
            }}
            value={draft.meetingResult}
            onChange={(e) => updateDraft({ meetingResult: e.target.value })}
            onKeyDown={handleEditorKeyDown('meetingResult')}
            disabled={!isEditing}
          />
        </div>
      </section>
    </div>
  );
}

export default MinutesPage;
