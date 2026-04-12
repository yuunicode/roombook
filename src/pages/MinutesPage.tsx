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
  suggestMinutesFromTranscript,
  transcribeChunk,
  type MinutesLockDto,
  type MinutesSuggestionResult,
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
type MinutesSectionKey = 'agenda' | 'meeting_content' | 'meeting_result';

type EditLock = {
  holderUserId: string;
  holderName: string;
  updatedAt: number;
};

const LOCK_HEARTBEAT_MS = 3000;
const LIVE_SYNC_MS = 5000;
const SILENCE_FLUSH_MS = 900;
const MIN_CHUNK_MS = 1500;
const MAX_CHUNK_MS = 15000;
const AUDIO_LEVEL_THRESHOLD = 0.018;
const MAX_UNDO_HISTORY = 100;
const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;
const MOCK_TRANSCRIPT_LINES = [
  '프로젝트 일정 점검을 위해 이번 주 목표를 다시 확인했습니다.',
  'API 응답 지연 문제는 캐시 정책 조정으로 우선 대응하기로 했습니다.',
  'UI 개편은 관리자 패널부터 단계적으로 적용하기로 합의했습니다.',
  '다음 스프린트 전까지 QA 체크리스트를 표준화하기로 했습니다.',
  '배포 전날 회귀 테스트 결과를 공유하고 승인 절차를 진행합니다.',
] as const;

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

function normalizeBulletText(value: string) {
  return value
    .trim()
    .replace(/^[-*•◦▪▫]\s*/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function mergeBulletPoints(existingText: string, suggestions: string[]) {
  const existingLines = existingText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const known = new Set(existingLines.map(normalizeBulletText));
  const appended: string[] = [];
  for (const item of suggestions) {
    const normalized = normalizeBulletText(item);
    if (!normalized || known.has(normalized)) continue;
    known.add(normalized);
    const cleaned = item
      .trim()
      .replace(/^(안건|주제|내용|결과)\s*:\s*/i, '')
      .trim();
    appended.push(`- ${cleaned}`);
  }
  if (appended.length === 0) {
    return existingText;
  }
  return [existingText.trim(), ...appended].filter((chunk) => chunk.length > 0).join('\n');
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
  const [isRecording, setIsRecording] = useState(false);
  const [isMockMode, setIsMockMode] = useState(import.meta.env.VITE_MOCK_AI === 'true');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [summarySuggestion, setSummarySuggestion] = useState<MinutesSuggestionResult>({
    agenda: [],
    meeting_content: [],
    meeting_result: [],
  });
  const historyRef = useRef<MinutesDraft[]>([]);
  const lastSavedKeyRef = useRef('');
  const isSavingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const lastChunkAtRef = useRef(0);
  const mockIntervalRef = useRef<number | null>(null);
  const mockLineIndexRef = useRef(0);
  const transcriptTextRef = useRef('');
  const transcriptQueueRef = useRef(Promise.resolve());

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

  useEffect(() => {
    transcriptTextRef.current = transcriptText;
  }, [transcriptText]);

  useEffect(() => {
    return () => {
      if (mockIntervalRef.current !== null) {
        window.clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      mediaRecorderRef.current?.stop();
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      analyserRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

    const openPrintFallback = () => {
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
              .pdf-export-toolbar {
                position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end;
                gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; background: #fff;
              }
              .pdf-export-button {
                border: 1px solid #d0d5dd; background: #fff; color: #344054; border-radius: 8px;
                height: 32px; padding: 0 12px; font-size: 13px; font-weight: 600; cursor: pointer;
              }
              #minutes-page-export-root { max-width: 960px; margin: 0 auto; padding: 24px 0 40px; }
              @media print { .pdf-export-toolbar { display: none; } }
            </style>
          </head>
          <body>
            <div class="pdf-export-toolbar">
              <button class="pdf-export-button" onclick="window.print()">PDF로 저장</button>
              <button class="pdf-export-button" onclick="window.close()">닫기</button>
            </div>
            ${source.outerHTML}
          </body>
        </html>
      `);
      popup.document.close();
      popup.focus();
      setSaveMessage('PDF 저장창을 열었습니다.');
    };

    void (async () => {
      try {
        setSaveMessage('PDF 생성 중입니다...');
        const [{ jsPDF }] = await Promise.all([import('jspdf')]);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        const exportRoot = source.cloneNode(true) as HTMLElement;
        exportRoot.style.maxWidth = '100%';
        exportRoot.style.margin = '0';
        exportRoot.style.padding = '0';

        const sandbox = document.createElement('div');
        sandbox.style.position = 'fixed';
        sandbox.style.left = '-99999px';
        sandbox.style.top = '0';
        sandbox.style.width = '794px';
        sandbox.style.background = '#ffffff';
        sandbox.appendChild(exportRoot);
        document.body.appendChild(sandbox);

        try {
          await pdf.html(exportRoot, {
            margin: [8, 8, 8, 8],
            autoPaging: 'text',
            html2canvas: {
              backgroundColor: '#ffffff',
              scale: 1,
              useCORS: true,
              logging: false,
            },
          });
        } finally {
          sandbox.remove();
        }

        pdf.save(`${baseName}.pdf`);
        setSaveMessage('PDF 다운로드가 시작되었습니다.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PDF 저장에 실패했습니다.';
        if (String(message).toLowerCase().includes('color')) {
          openPrintFallback();
          return;
        }
        setSaveMessage(`PDF 저장 실패: ${message}`);
        window.alert(`PDF 저장에 실패했습니다.\n${message}`);
      }
    })();
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  };

  const queueTranscription = useCallback((blob: Blob) => {
    transcriptQueueRef.current = transcriptQueueRef.current
      .then(async () => {
        if (blob.size === 0) return;
        setIsTranscribing(true);
        const base64 = await blobToBase64(blob);
        const result = await transcribeChunk({
          audio_base64: base64,
          mime_type: blob.type || 'audio/webm',
          previous_text: transcriptTextRef.current.slice(-1200),
        });
        const chunk = result.text.trim();
        if (!chunk) return;
        setTranscriptText((prev) => (prev ? `${prev}\n${chunk}` : chunk));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '전사 중 오류가 발생했습니다.';
        setSaveMessage(message);
      })
      .finally(() => {
        setIsTranscribing(false);
      });
  }, []);

  const stopAudioResources = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const startMockRecording = useCallback(() => {
    mockLineIndexRef.current = 0;
    setIsRecording(true);
    setIsTranscribing(false);
    setSaveMessage('모의 녹음을 시작했습니다.');
    mockIntervalRef.current = window.setInterval(() => {
      const nextLine = MOCK_TRANSCRIPT_LINES[mockLineIndexRef.current];
      if (!nextLine) {
        if (mockIntervalRef.current !== null) {
          window.clearInterval(mockIntervalRef.current);
          mockIntervalRef.current = null;
        }
        setIsRecording(false);
        return;
      }
      setTranscriptText((prev) => (prev ? `${prev}\n${nextLine}` : nextLine));
      mockLineIndexRef.current += 1;
    }, 1800);
  }, []);

  const startSilenceBasedRecording = useCallback(
    async (stream: MediaStream) => {
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) queueTranscription(event.data);
      };
      recorder.onstop = () => {
        stopAudioResources();
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      speakingRef.current = false;
      const now = performance.now();
      lastVoiceAtRef.current = now;
      lastChunkAtRef.current = now;

      const buffer = new Uint8Array(analyser.fftSize);
      const tick = () => {
        const activeRecorder = mediaRecorderRef.current;
        if (!activeRecorder || activeRecorder.state === 'inactive') return;
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const centered = (buffer[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const ts = performance.now();
        if (rms >= AUDIO_LEVEL_THRESHOLD) {
          speakingRef.current = true;
          lastVoiceAtRef.current = ts;
        }

        const silenceElapsed = ts - lastVoiceAtRef.current;
        const chunkElapsed = ts - lastChunkAtRef.current;
        const shouldFlushBySilence =
          speakingRef.current && silenceElapsed >= SILENCE_FLUSH_MS && chunkElapsed >= MIN_CHUNK_MS;
        const shouldFlushByMax = chunkElapsed >= MAX_CHUNK_MS;
        if (shouldFlushBySilence || shouldFlushByMax) {
          activeRecorder.requestData();
          speakingRef.current = false;
          lastChunkAtRef.current = ts;
        }
        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      recorder.start();
      setIsRecording(true);
      setSaveMessage('침묵 기반 녹음을 시작했습니다.');
      rafIdRef.current = window.requestAnimationFrame(tick);
    },
    [queueTranscription, stopAudioResources]
  );

  const handleStartRecording = useCallback(() => {
    if (isMockMode) {
      startMockRecording();
      return;
    }
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await startSilenceBasedRecording(stream);
      } catch (error) {
        const message = error instanceof Error ? error.message : '마이크 권한을 확인해 주세요.';
        setSaveMessage(`녹음 시작 실패: ${message}`);
      }
    })();
  }, [isMockMode, startMockRecording, startSilenceBasedRecording]);

  const handleStopRecording = useCallback(() => {
    if (isMockMode) {
      if (mockIntervalRef.current !== null) {
        window.clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
      setIsRecording(false);
      return;
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, [isMockMode]);

  const handleGenerateMinutes = useCallback(() => {
    void (async () => {
      if (!transcriptText.trim()) {
        setSaveMessage('전사 텍스트가 비어있습니다.');
        return;
      }
      try {
        setIsGeneratingSummary(true);
        if (isMockMode) {
          const lines = transcriptText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          const agenda = lines.slice(0, 3);
          const meetingContent = lines.slice(1, 5);
          const meetingResult = lines.slice(-3);
          setSummarySuggestion({
            agenda,
            meeting_content: meetingContent,
            meeting_result: meetingResult,
          });
          setSaveMessage('모의 AI 제안이 생성되었습니다.');
          return;
        }
        const result = await suggestMinutesFromTranscript({
          transcript: transcriptText,
          existing_agenda: draft.agenda,
          existing_meeting_content: draft.meetingContent,
          existing_meeting_result: draft.meetingResult,
        });
        setSummarySuggestion(result);
        setSaveMessage('AI 제안이 생성되었습니다.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 제안 생성에 실패했습니다.';
        setSaveMessage(message);
      } finally {
        setIsGeneratingSummary(false);
      }
    })();
  }, [draft.agenda, draft.meetingContent, draft.meetingResult, isMockMode, transcriptText]);

  const applySuggestionSection = useCallback(
    (section: MinutesSectionKey) => {
      if (!isEditing) {
        setSaveMessage('수정 모드에서만 반영할 수 있습니다.');
        return;
      }
      if (section === 'agenda') {
        const merged = mergeBulletPoints(draft.agenda, summarySuggestion.agenda);
        updateDraft({ agenda: merged });
        return;
      }
      if (section === 'meeting_content') {
        const merged = mergeBulletPoints(draft.meetingContent, summarySuggestion.meeting_content);
        updateDraft({ meetingContent: merged });
        return;
      }
      const merged = mergeBulletPoints(draft.meetingResult, summarySuggestion.meeting_result);
      updateDraft({ meetingResult: merged });
    },
    [
      draft.agenda,
      draft.meetingContent,
      draft.meetingResult,
      isEditing,
      summarySuggestion,
      updateDraft,
    ]
  );

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 0 40px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 340px)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <div id="minutes-page-export-root" style={{ maxWidth: '960px' }}>
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
                      setSelectedAttendees((prev) =>
                        prev.filter((item) => item.id !== attendee.id)
                      );
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
        <aside
          style={{
            position: 'sticky',
            top: '16px',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '14px' }}>실시간 녹음/전사</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '12px' }}>
              {isMockMode ? '모의 모드 (백엔드 호출 없음)' : 'gpt-4o-transcript · 침묵 기반 분할'}
            </p>
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-soft)',
            }}
          >
            <input
              type="checkbox"
              checked={isMockMode}
              disabled={isRecording || isTranscribing}
              onChange={(event) => setIsMockMode(event.target.checked)}
            />
            모의 모드 사용
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isRecording ? (
              <button className="nav-menu-item" type="button" onClick={handleStartRecording}>
                녹음 시작
              </button>
            ) : (
              <button className="nav-menu-item" type="button" onClick={handleStopRecording}>
                녹음 중지
              </button>
            )}
            <button
              className="nav-menu-item"
              type="button"
              onClick={() => setTranscriptText('')}
              disabled={isRecording || isTranscribing}
            >
              전사 초기화
            </button>
          </div>
          <div
            style={{
              minHeight: '140px',
              maxHeight: '220px',
              overflowY: 'auto',
              background: '#fafafb',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '12px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {transcriptText || '녹음을 시작하면 전사 텍스트가 실시간으로 표시됩니다.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-soft)' }}>
              {isTranscribing
                ? '전사 요청 중...'
                : isRecording
                  ? isMockMode
                    ? '모의 전사 중'
                    : '녹음 중 (침묵 시 청크 전송)'
                  : '대기 중'}
            </span>
            <button
              className="linear-primary-button"
              type="button"
              onClick={handleGenerateMinutes}
              disabled={
                isRecording || isTranscribing || isGeneratingSummary || !transcriptText.trim()
              }
              style={{ width: 'auto', padding: '0 12px', height: '30px' }}
            >
              {isGeneratingSummary ? '생성 중...' : '회의록 자동생성'}
            </button>
          </div>
          <div
            style={{
              borderTop: '1px dashed var(--border)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <strong style={{ fontSize: '12px' }}>[주요 안건] 제안</strong>
                <button
                  className="nav-menu-item"
                  type="button"
                  onClick={() => applySuggestionSection('agenda')}
                >
                  반영
                </button>
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {summarySuggestion.agenda.map((item, index) => (
                  <li key={`agenda-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <strong style={{ fontSize: '12px' }}>[회의 내용] 제안</strong>
                <button
                  className="nav-menu-item"
                  type="button"
                  onClick={() => applySuggestionSection('meeting_content')}
                >
                  반영
                </button>
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {summarySuggestion.meeting_content.map((item, index) => (
                  <li key={`content-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <strong style={{ fontSize: '12px' }}>[회의 결과] 제안</strong>
                <button
                  className="nav-menu-item"
                  type="button"
                  onClick={() => applySuggestionSection('meeting_result')}
                >
                  반영
                </button>
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {summarySuggestion.meeting_result.map((item, index) => (
                  <li key={`result-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default MinutesPage;
