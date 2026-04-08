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
import { useAppState, type AppUser } from '../stores';
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

const AUTO_SAVE_INTERVAL_MS = 3000;
const LOCK_HEARTBEAT_MS = 3000;
const LOCK_POLL_INTERVAL_MS = 1000;
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

function MinutesPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const { userEmail, users, reservations, reservationLabels, updateReservation } = useAppState();

  const reservation = useMemo(
    () => (reservationId ? (reservations.find((item) => item.id === reservationId) ?? null) : null),
    [reservationId, reservations]
  );

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
    if (!reservation || isEditing) {
      return;
    }

    const nextDraft: MinutesDraft = {
      label: reservation.label ?? reservationLabels[0] ?? '',
      title: reservation.title ?? '',
      dateInput: format(reservation.start, 'yyyy-MM-dd'),
      startTimeInput: format(reservation.start, 'HH:mm'),
      endTimeInput: format(reservation.end, 'HH:mm'),
      externalAttendees: reservation.externalAttendees ?? '',
      agenda: reservation.agenda ?? '',
      meetingContent: reservation.meetingContent ?? '',
      meetingResult: reservation.meetingResult ?? '',
    };

    setDraft(nextDraft);
    setSelectedAttendees(reservation.attendees ?? []);
    setAttendeeQuery('');
    historyRef.current = [];
    setSaveMessage('');
    lastSavedKeyRef.current = JSON.stringify({
      draft: nextDraft,
      attendees: (reservation.attendees ?? []).map((attendee) => attendee.id),
    });
  }, [reservation, reservationLabels, isEditing]);

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
    const poll = window.setInterval(() => {
      void (async () => {
        const current = await readLock();
        setActiveLock(current);
        if (isEditing && current && current.holderUserId !== viewerId) {
          setIsEditing(false);
          setSaveMessage(`${current.holderName}가 수정중입니다.`);
        }
      })();
    }, LOCK_POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [isEditing, readLock, viewerId]);

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
      setSaveMessage('자동 저장 대기 중...');
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
    return users.filter(
      (user) =>
        !selectedAttendees.some((attendee) => attendee.id === user.id) &&
        (user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword))
    );
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

  const saveDraft = useCallback(
    (mode: 'auto' | 'manual') => {
      if (!reservation || !isEditing) {
        return;
      }

      if (!draft.title.trim() || !draft.dateInput || !draft.startTimeInput || !draft.endTimeInput) {
        if (mode === 'manual') {
          setSaveMessage('필수 항목을 먼저 입력하세요.');
        }
        return;
      }

      const nextStart = new Date(`${draft.dateInput}T${draft.startTimeInput}`);
      const nextEnd = new Date(`${draft.dateInput}T${draft.endTimeInput}`);
      if (
        Number.isNaN(nextStart.getTime()) ||
        Number.isNaN(nextEnd.getTime()) ||
        nextEnd <= nextStart
      ) {
        if (mode === 'manual') {
          setSaveMessage('날짜/시간이 올바르지 않습니다.');
        }
        return;
      }

      updateReservation(reservation.id, {
        title: draft.title,
        label: draft.label,
        start: nextStart,
        end: nextEnd,
        attendees: selectedAttendees,
        externalAttendees: draft.externalAttendees,
        agenda: draft.agenda,
        meetingContent: draft.meetingContent,
        meetingResult: draft.meetingResult,
        minutesAttachment: reservation.minutesAttachment,
      });

      lastSavedKeyRef.current = JSON.stringify({
        draft,
        attendees: selectedAttendees.map((attendee) => attendee.id),
      });
      if (mode === 'manual') {
        setSaveMessage('저장되었습니다.');
      } else {
        setSaveMessage(`자동 저장됨 (${format(new Date(), 'HH:mm:ss')})`);
      }
    },
    [reservation, isEditing, draft, selectedAttendees, updateReservation]
  );

  useEffect(() => {
    if (!reservation || !isEditing) return;
    const timer = window.setInterval(() => {
      const currentKey = JSON.stringify({
        draft,
        attendees: selectedAttendees.map((attendee) => attendee.id),
      });
      if (currentKey === lastSavedKeyRef.current) return;
      saveDraft('auto');
    }, AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reservation, isEditing, draft, selectedAttendees, saveDraft]);

  const internalAttendeeText = selectedAttendees.map((attendee) => attendee.name).join(', ');
  const lockByOther = Boolean(activeLock && activeLock.holderUserId !== viewerId);
  const lockTooltip = lockByOther ? `${activeLock?.holderName}가 수정하고있습니다.` : '';

  const handleEditToggle = () => {
    if (isEditing) {
      setIsEditing(false);
      void releaseLock();
      setSaveMessage('읽기 모드로 전환되었습니다.');
      return;
    }
    void (async () => {
      const acquired = await acquireLock();
      if (!acquired) return;
      setIsEditing(true);
      setSaveMessage('수정 모드입니다.');
    })();
  };

  const handleDownloadMarkdown = () => {
    if (!reservation) return;

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
    link.download = `${toMarkdownFilename(draft.title)}.md`;
    link.click();
    URL.revokeObjectURL(url);
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

  if (!reservation) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">예약 정보를 찾을 수 없습니다</h2>
        <p className="page-subtitle">삭제되었거나 잘못된 접근입니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 0 40px' }}>
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '12px',
        }}
      >
        <p
          className="status-info-value"
          style={{ color: saveMessage.includes('저장') ? '#18794e' : '#d92d20', margin: 0 }}
        >
          {saveMessage}
        </p>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
          <button
            className="page-mode-button"
            type="button"
            onClick={handleDownloadMarkdown}
            aria-label="마크다운 다운로드"
            title="마크다운 다운로드"
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(16, 18, 24, 0.08)',
              color: '#6b563e',
              border: '1px solid rgba(107, 86, 62, 0.22)',
              borderRadius: '8px',
              width: '28px',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <AppIcon name="download" style={{ width: '14px', height: '14px' }} />
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
            {isEditing ? '수정 종료' : '수정'}
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
              disabled={!isEditing}
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">시작 시간</label>
            <input
              className="linear-input"
              type="time"
              value={draft.startTimeInput}
              onChange={(e) => updateDraft({ startTimeInput: e.target.value })}
              disabled={!isEditing}
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">종료 시간</label>
            <input
              className="linear-input"
              type="time"
              value={draft.endTimeInput}
              onChange={(e) => updateDraft({ endTimeInput: e.target.value })}
              disabled={!isEditing}
            />
          </div>
        </div>

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <label className="status-info-label">내부 참석자</label>
          <input
            className="linear-input"
            style={{ marginBottom: '8px' }}
            value={attendeeQuery}
            placeholder="이름 또는 이메일 검색..."
            onChange={(e) => setAttendeeQuery(e.target.value)}
            disabled={!isEditing}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
            {selectedAttendees.length === 0 && <span className="status-info-value">없음</span>}
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            gap: '12px',
          }}
        >
          <div />
          <button
            className="linear-primary-button"
            type="button"
            style={{ width: 'auto', padding: '0 24px', whiteSpace: 'nowrap' }}
            onClick={() => saveDraft('manual')}
            disabled={!isEditing}
          >
            저장하기
          </button>
        </div>
      </section>
    </div>
  );
}

export default MinutesPage;
