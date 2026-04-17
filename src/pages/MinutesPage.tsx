import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState, type AppReservation, type AppUser } from '../stores';
import AppIcon from '../components/ui/AppIcon';
import {
  acquireMinutesLock as acquireMinutesLockApi,
  getMinutesLiveState as getMinutesLiveStateApi,
  getMinutesLock as getMinutesLockApi,
  releaseMinutesLock as releaseMinutesLockApi,
  suggestMinutesFromTranscript,
  transcribeChunk,
  updateMinutesLiveState as updateMinutesLiveStateApi,
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
const SILENCE_PARAGRAPH_MS = 1200;
const AUDIO_LEVEL_THRESHOLD = 0.018;
const MAX_UNDO_HISTORY = 100;
const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;
const RECORDING_SEGMENT_SECONDS = 15;
const MIN_FINAL_SEGMENT_SECONDS = 0.75;
const LEAVE_EDIT_CONFIRM_MESSAGE =
  '수정완료를 누르지 않고 나가면 변경사항이 저장되지 않습니다. 이동하시겠습니까?';
const GENERATING_SUMMARY_BLOCK_MESSAGE =
  '회의록 자동생성 중입니다. 완료될 때까지 페이지를 나갈 수 없습니다.';
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

function formatSuggestionBullets(suggestions: string[]) {
  return suggestions
    .map((item) =>
      item
        .trim()
        .replace(/^(안건|주제|내용|결과)\s*:\s*/i, '')
        .replace(/^[-*•◦▪▫]+\s*/, '')
        .trim()
    )
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join('\n');
}

function displaySuggestionItem(value: string) {
  return value.trim().replace(/^[-*•◦▪▫]+\s*/, '');
}

function normalizeMeetingContentBlock(value: string) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^(안건|주제|내용|결과)\s*:\s*/i, '')
        .replace(/^[-*•◦▪▫]+\s*/, '')
        .trim()
    )
    .filter(Boolean);

  if (lines.length === 0) return '';

  const [title, ...details] = lines;
  if (details.length === 0) {
    return `- ${title}`;
  }

  return [`- ${title}`, ...details.map((detail) => `\t◦ ${detail}`)].join('\n');
}

function formatMeetingContentBlocks(suggestions: string[]) {
  return suggestions.map(normalizeMeetingContentBlock).filter(Boolean).join('\n\n');
}

function buildMinutesMarkdown(draft: MinutesDraft, internalAttendeeText: string) {
  return [
    `# ${draft.title || '회의록 제목'}`,
    '',
    `- 라벨: ${draft.label || '-'}`,
    `- 날짜: ${draft.dateInput || '-'}`,
    `- 시간: ${draft.startTimeInput || '-'} ~ ${draft.endTimeInput || '-'}`,
    `- 내부 참석자: ${internalAttendeeText || '없음'}`,
    `- 외부 참석자: ${draft.externalAttendees || '없음'}`,
    '',
    '## 주요 안건',
    draft.agenda || '',
    '',
    '## 회의 내용',
    draft.meetingContent || '',
    '',
    '## 회의 결과',
    draft.meetingResult || '',
    '',
  ].join('\n');
}

function encodeWavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pcmBuffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(pcmBuffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([pcmBuffer], { type: 'audio/wav' });
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isAutoRecordPanelOpen, setIsAutoRecordPanelOpen] = useState(false);
  const [sharedIsRecording, setSharedIsRecording] = useState(false);
  const [sharedRecorderName, setSharedRecorderName] = useState('');
  const [sharedRecorderUserId, setSharedRecorderUserId] = useState('');
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<number | null>(null);
  const [summarySuggestion, setSummarySuggestion] = useState<MinutesSuggestionResult>({
    agenda: [],
    meeting_content: [],
    meeting_result: [],
  });
  const activeLockRef = useRef<EditLock | null>(null);
  const historyRef = useRef<MinutesDraft[]>([]);
  const lastSavedKeyRef = useRef('');
  const isSavingRef = useRef(false);
  const isGeneratingSummaryRef = useRef(false);
  const recordingActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const processorSinkRef = useRef<GainNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const insertParagraphBreakRef = useRef(false);
  const segmentSampleRateRef = useRef(0);
  const segmentChunksRef = useRef<Float32Array[]>([]);
  const segmentSampleCountRef = useRef(0);
  const recordingSessionBaseTextRef = useRef('');
  const recordingSessionTextRef = useRef('');
  const transcriptTextRef = useRef('');
  const transcriptQueueRef = useRef(Promise.resolve());
  const transcribePendingCountRef = useRef(0);

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

  const loadLatestMinutesSnapshot = useCallback(async () => {
    if (!reservationId) return;
    try {
      const reservationDetail = await getReservationMinutes(reservationId);
      if (reservationDetail) {
        setMinutesReservation(reservationDetail);
      }
      const state = await getMinutesLiveStateApi(reservationId);
      setTranscriptText(state.transcript_text ?? '');
      setSharedIsRecording(state.is_recording);
      setSharedRecorderName(state.updated_by_name ?? '');
      setSharedRecorderUserId(state.updated_by_user_id ?? '');
    } catch {
      // 라이브 전사 동기화 실패는 UI 동작을 막지 않는다.
    }
  }, [getReservationMinutes, reservationId]);

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
    activeLockRef.current = activeLock;
  }, [activeLock]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      recordingActiveRef.current = false;
      processorNodeRef.current?.disconnect();
      processorNodeRef.current = null;
      processorSinkRef.current?.disconnect();
      processorSinkRef.current = null;
      void audioContextRef.current?.close().catch(() => undefined);
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
    if (!reservationId || isEditing) return;
    void (async () => {
      const result = await getReservationMinutes(reservationId);
      if (!result) return;
      setMinutesReservation(result);
    })();
  }, [getReservationMinutes, isEditing, reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    if (isEditing) return;
    const syncLock = () => {
      void (async () => {
        const previousLock = activeLockRef.current;
        const lock = await readLock();
        setActiveLock(lock);
        if (previousLock && previousLock.holderUserId !== viewerId && lock === null) {
          await loadLatestMinutesSnapshot();
        }
      })();
    };
    syncLock();
    const intervalId = window.setInterval(syncLock, LOCK_HEARTBEAT_MS);
    return () => window.clearInterval(intervalId);
  }, [isEditing, loadLatestMinutesSnapshot, readLock, reservationId, viewerId]);

  useEffect(() => {
    void loadLatestMinutesSnapshot();
  }, [loadLatestMinutesSnapshot]);

  useEffect(() => {
    if (!isEditing) return;
    const intervalId = window.setInterval(() => {
      void persistDraft('silent');
    }, LIVE_SYNC_MS);
    return () => window.clearInterval(intervalId);
  }, [isEditing, persistDraft]);

  useEffect(() => {
    if (!isEditing) {
      setIsAutoRecordPanelOpen(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && !isGeneratingSummary) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, isGeneratingSummary]);

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
    const markdown = buildMinutesMarkdown(draft, internalAttendeeText);

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.md`;
    link.click();
    URL.revokeObjectURL(url);
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

  const stopAudioResources = useCallback(() => {
    recordingActiveRef.current = false;
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    processorNodeRef.current?.disconnect();
    processorNodeRef.current = null;
    processorSinkRef.current?.disconnect();
    processorSinkRef.current = null;
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const queueTranscriptionChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0 || !reservationId) return;
      transcriptQueueRef.current = transcriptQueueRef.current
        .then(async () => {
          transcribePendingCountRef.current += 1;
          setIsTranscribing(true);
          const base64 = await blobToBase64(blob);
          const result = await transcribeChunk({
            audio_base64: base64,
            mime_type: blob.type || 'audio/webm',
          });
          const nextText = result.text.trim();
          if (!nextText) return;
          const baseText = recordingSessionBaseTextRef.current.trim();
          const sessionText = recordingSessionTextRef.current.trim();
          const separator = insertParagraphBreakRef.current ? '\n\n' : '\n';
          const nextSessionText = sessionText ? `${sessionText}${separator}${nextText}` : nextText;
          recordingSessionTextRef.current = nextSessionText;
          const mergedText = baseText ? `${baseText}\n\n${nextSessionText}` : nextSessionText;
          insertParagraphBreakRef.current = false;
          const liveState = await updateMinutesLiveStateApi(reservationId, {
            transcript_text: mergedText,
          });
          setTranscriptText(liveState.transcript_text ?? '');
          setSharedIsRecording(liveState.is_recording);
          setSharedRecorderName(liveState.updated_by_name ?? '');
          setSharedRecorderUserId(liveState.updated_by_user_id ?? '');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : '전사 중 오류가 발생했습니다.';
          if (message.includes('Audio file might be corrupted or unsupported')) {
            return;
          }
          setSaveMessage(message);
        })
        .finally(() => {
          transcribePendingCountRef.current = Math.max(0, transcribePendingCountRef.current - 1);
          if (transcribePendingCountRef.current === 0) {
            setIsTranscribing(false);
          }
        });
      await transcriptQueueRef.current;
    },
    [reservationId]
  );

  const flushPcmSegment = useCallback(
    (force: boolean) => {
      const sampleRate = segmentSampleRateRef.current;
      const totalSamples = segmentSampleCountRef.current;
      if (!sampleRate || totalSamples === 0) return;

      const minSamples = Math.floor(sampleRate * MIN_FINAL_SEGMENT_SECONDS);
      if (!force && totalSamples < sampleRate * RECORDING_SEGMENT_SECONDS) {
        return;
      }
      if (force && totalSamples < minSamples) {
        segmentChunksRef.current = [];
        segmentSampleCountRef.current = 0;
        return;
      }

      const wavBlob = encodeWavBlob(segmentChunksRef.current, sampleRate);
      segmentChunksRef.current = [];
      segmentSampleCountRef.current = 0;
      void queueTranscriptionChunk(wavBlob);
    },
    [queueTranscriptionChunk]
  );

  const startSingleRecording = useCallback(
    async (stream: MediaStream) => {
      recordingSessionBaseTextRef.current = transcriptTextRef.current.trim();
      recordingSessionTextRef.current = '';
      mediaStreamRef.current = stream;
      recordingActiveRef.current = true;
      segmentChunksRef.current = [];
      segmentSampleCountRef.current = 0;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentSink = audioContext.createGain();
      silentSink.gain.value = 0;
      analyser.fftSize = 2048;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      processorNodeRef.current = processor;
      processorSinkRef.current = silentSink;
      segmentSampleRateRef.current = audioContext.sampleRate;

      speakingRef.current = false;
      const now = performance.now();
      lastVoiceAtRef.current = now;
      insertParagraphBreakRef.current = false;

      const buffer = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!recordingActiveRef.current) {
          return;
        }
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
        if (speakingRef.current && silenceElapsed >= SILENCE_PARAGRAPH_MS) {
          insertParagraphBreakRef.current = true;
          speakingRef.current = false;
        }

        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      processor.onaudioprocess = (event) => {
        if (!recordingActiveRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        if (!input || input.length === 0) return;
        const copy = new Float32Array(input.length);
        copy.set(input);
        segmentChunksRef.current.push(copy);
        segmentSampleCountRef.current += copy.length;
        if (segmentSampleCountRef.current >= audioContext.sampleRate * RECORDING_SEGMENT_SECONDS) {
          flushPcmSegment(false);
        }
      };

      rafIdRef.current = window.requestAnimationFrame(tick);
      setIsRecording(true);
      setIsStoppingRecording(false);
      setSaveMessage('녹음을 시작했습니다. 약 15초 단위로 음성 청크를 전사해 반영합니다.');
      if (reservationId) {
        try {
          const liveState = await updateMinutesLiveStateApi(reservationId, {
            is_recording: true,
          });
          setSharedIsRecording(liveState.is_recording);
          setSharedRecorderName(liveState.updated_by_name ?? '');
          setSharedRecorderUserId(liveState.updated_by_user_id ?? '');
          setTranscriptText(liveState.transcript_text ?? '');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '녹음 상태 동기화에 실패했습니다.';
          setSaveMessage(message);
        }
      }
    },
    [flushPcmSegment, reservationId]
  );

  const handleStartRecording = useCallback(() => {
    if (!isEditing) {
      setSaveMessage('수정 모드에서만 녹음을 시작할 수 있습니다.');
      return;
    }
    const recordingByOther = sharedIsRecording && sharedRecorderUserId !== viewerId;
    if (recordingByOther) {
      setSaveMessage(`${sharedRecorderName || '다른 사용자'}가 녹음 중입니다.`);
      return;
    }
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await startSingleRecording(stream);
      } catch (error) {
        const message = error instanceof Error ? error.message : '마이크 권한을 확인해 주세요.';
        setSaveMessage(`녹음 시작 실패: ${message}`);
      }
    })();
  }, [
    isEditing,
    sharedIsRecording,
    sharedRecorderName,
    sharedRecorderUserId,
    startSingleRecording,
    viewerId,
  ]);

  const handleStopRecording = useCallback(() => {
    if (isStoppingRecording) return;
    setIsStoppingRecording(true);
    recordingActiveRef.current = false;
    flushPcmSegment(true);
    stopAudioResources();
    setIsRecording(false);
    void (async () => {
      try {
        await transcriptQueueRef.current;
        if (reservationId) {
          const liveState = await updateMinutesLiveStateApi(reservationId, {
            is_recording: false,
          });
          setSharedIsRecording(liveState.is_recording);
          setSharedRecorderName(liveState.updated_by_name ?? '');
          setSharedRecorderUserId(liveState.updated_by_user_id ?? '');
          setTranscriptText(liveState.transcript_text ?? '');
        }
        setSaveMessage('녹음이 종료되었습니다.');
      } catch {
        setSaveMessage('녹음은 종료되었지만 마지막 전사 반영에 실패했습니다.');
      } finally {
        recordingSessionBaseTextRef.current = '';
        recordingSessionTextRef.current = '';
        setIsStoppingRecording(false);
      }
    })();
    setSaveMessage('녹음을 종료하는 중입니다...');
  }, [flushPcmSegment, isStoppingRecording, reservationId, stopAudioResources]);

  const handleGenerateMinutes = useCallback(() => {
    if (isGeneratingSummaryRef.current) {
      return;
    }
    void (async () => {
      if (!transcriptText.trim()) {
        setSaveMessage('전사 텍스트가 비어있습니다.');
        return;
      }
      try {
        isGeneratingSummaryRef.current = true;
        flushSync(() => {
          setIsGeneratingSummary(true);
          setSummaryGeneratedAt(null);
          setSummarySuggestion({
            agenda: [],
            meeting_content: [],
            meeting_result: [],
          });
          setSaveMessage('회의록 자동생성 중입니다...');
        });
        const result = await suggestMinutesFromTranscript({
          transcript: transcriptText,
          existing_agenda: draft.agenda,
          existing_meeting_content: draft.meetingContent,
          existing_meeting_result: draft.meetingResult,
        });
        setSummarySuggestion(result);
        setSummaryGeneratedAt(Date.now());
        if (
          result.agenda.length === 0 &&
          result.meeting_content.length === 0 &&
          result.meeting_result.length === 0
        ) {
          setSaveMessage('생성은 완료되었지만 새로 제안할 내용이 없습니다.');
          return;
        }
        setSaveMessage(
          `AI 제안이 생성되었습니다. (안건 ${result.agenda.length}건, 내용 ${result.meeting_content.length}건, 결과 ${result.meeting_result.length}건)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 제안 생성에 실패했습니다.';
        setSaveMessage(message);
      } finally {
        isGeneratingSummaryRef.current = false;
        setIsGeneratingSummary(false);
      }
    })();
  }, [draft.agenda, draft.meetingContent, draft.meetingResult, transcriptText]);

  const applySuggestionForSection = useCallback(
    (section: MinutesSectionKey) => {
      if (!isEditing) {
        setSaveMessage('수정 모드에서만 반영할 수 있습니다.');
        return;
      }
      if (section === 'agenda') {
        updateDraft({ agenda: formatSuggestionBullets(summarySuggestion.agenda) });
        setSaveMessage('주요 안건에 AI 제안을 반영했습니다.');
        return;
      }
      if (section === 'meeting_content') {
        updateDraft({
          meetingContent: formatMeetingContentBlocks(summarySuggestion.meeting_content),
        });
        setSaveMessage('회의 내용에 AI 제안을 반영했습니다.');
        return;
      }
      updateDraft({
        meetingResult: formatSuggestionBullets(summarySuggestion.meeting_result),
      });
      setSaveMessage('회의 결과에 AI 제안을 반영했습니다.');
    },
    [isEditing, summarySuggestion, updateDraft]
  );

  const handleGoBack = () => {
    if (isGeneratingSummary) {
      setSaveMessage(GENERATING_SUMMARY_BLOCK_MESSAGE);
      return;
    }
    if (isEditing && !window.confirm(LEAVE_EDIT_CONFIRM_MESSAGE)) {
      return;
    }
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

  const showAutoRecordPanel = isEditing && isAutoRecordPanelOpen;
  const hasSummarySuggestion =
    summarySuggestion.agenda.length > 0 ||
    summarySuggestion.meeting_content.length > 0 ||
    summarySuggestion.meeting_result.length > 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 0 40px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showAutoRecordPanel
            ? 'minmax(0, 1fr) minmax(0, 1fr)'
            : 'minmax(0, 1fr)',
          gap: '16px',
          alignItems: 'start',
          justifyItems: showAutoRecordPanel ? 'stretch' : 'center',
        }}
      >
        <div
          id="minutes-page-export-root"
          style={{ width: '100%', maxWidth: showAutoRecordPanel ? 'none' : '960px' }}
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

            {isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button
                  className="page-mode-button"
                  type="button"
                  onClick={() => setIsAutoRecordPanelOpen((prev) => !prev)}
                  style={{
                    whiteSpace: 'nowrap',
                    background: isAutoRecordPanelOpen
                      ? 'rgba(36, 99, 235, 0.12)'
                      : 'rgba(16, 18, 24, 0.08)',
                    color: isAutoRecordPanelOpen ? '#1d4ed8' : '#6b563e',
                    border: `1px solid ${isAutoRecordPanelOpen ? 'rgba(36, 99, 235, 0.35)' : 'rgba(107, 86, 62, 0.22)'}`,
                    borderRadius: '8px',
                    padding: '0 10px',
                    height: '28px',
                    fontSize: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {isAutoRecordPanelOpen ? '회의 자동기록 닫기' : '회의 자동기록'}
                </button>
              </div>
            )}

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
              <div className="minutes-section-title">주요 안건</div>
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
              <div className="minutes-section-title">회의 내용</div>
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
              <div className="minutes-section-title">회의 결과</div>
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
        {showAutoRecordPanel && (
          <aside
            style={{
              position: 'sticky',
              top: '16px',
              alignSelf: 'start',
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px' }}>회의 자동기록</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '12px' }}>
                  녹음하면 전사 내용을 여기에서 확인하고 바로 회의록으로 정리할 수 있습니다.
                </p>
              </div>
              <button
                className="nav-menu-item"
                type="button"
                onClick={() => {
                  if (!isEditing || !reservationId) {
                    setSaveMessage('수정 모드에서만 전사를 초기화할 수 있습니다.');
                    return;
                  }
                  void (async () => {
                    try {
                      const liveState = await updateMinutesLiveStateApi(reservationId, {
                        transcript_text: '',
                      });
                      recordingSessionBaseTextRef.current = '';
                      recordingSessionTextRef.current = '';
                      setTranscriptText(liveState.transcript_text ?? '');
                      setSharedIsRecording(liveState.is_recording);
                      setSharedRecorderName(liveState.updated_by_name ?? '');
                      setSharedRecorderUserId(liveState.updated_by_user_id ?? '');
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : '전사 초기화에 실패했습니다.';
                      setSaveMessage(message);
                    }
                  })();
                }}
                disabled={isRecording || isTranscribing || !isEditing}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  fontSize: '12px',
                  alignSelf: 'flex-start',
                }}
              >
                초기화
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="nav-menu-item"
                type="button"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={
                  isStoppingRecording ||
                  !isEditing ||
                  (sharedIsRecording && sharedRecorderUserId !== viewerId)
                }
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderColor: '#d92d20',
                  justifyContent: 'center',
                  background: isRecording ? '#b42318' : '#d92d20',
                  color: '#ffffff',
                  flex: 1,
                }}
              >
                {isRecording ? '녹음중...' : '녹음 시작'}
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
              {transcriptText}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-soft)' }}>
                {isTranscribing
                  ? '전사 처리 중...'
                  : isRecording
                    ? '녹음 중'
                    : sharedIsRecording
                      ? sharedRecorderUserId === viewerId
                        ? '내가 다른 탭에서 녹음 중'
                        : `${sharedRecorderName || '다른 사용자'}가 녹음 중`
                      : '대기 중'}
              </span>
              <button
                className="linear-primary-button"
                type="button"
                onClick={handleGenerateMinutes}
                disabled={
                  isRecording || isTranscribing || isGeneratingSummary || !transcriptText.trim()
                }
                style={{
                  width: 'auto',
                  padding: '0 12px',
                  height: '30px',
                  opacity:
                    isRecording || isTranscribing || isGeneratingSummary || !transcriptText.trim()
                      ? 0.5
                      : 1,
                  cursor:
                    isRecording || isTranscribing || isGeneratingSummary || !transcriptText.trim()
                      ? 'not-allowed'
                      : 'pointer',
                }}
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
              {isGeneratingSummary && (
                <div
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#1d4ed8',
                  }}
                >
                  회의록 자동생성 요청을 처리 중입니다. 전사 길이에 따라 수 초 이상 걸릴 수 있습니다.
                </div>
              )}
              {!isGeneratingSummary && summaryGeneratedAt !== null && !hasSummarySuggestion && (
                <div
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: 'var(--text-soft)',
                  }}
                >
                  생성은 완료되었지만 기존 작성 내용과 겹치지 않는 새 제안이 없었습니다.
                </div>
              )}
              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <strong style={{ fontSize: '12px' }}>[주요 안건] 제안</strong>
                  <button
                    className="nav-menu-item"
                    type="button"
                    onClick={() => applySuggestionForSection('agenda')}
                    disabled={summarySuggestion.agenda.length === 0}
                  >
                    반영
                  </button>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                  {summarySuggestion.agenda.map((item, index) => (
                    <li key={`agenda-${index}`}>{displaySuggestionItem(item)}</li>
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
                    onClick={() => applySuggestionForSection('meeting_content')}
                    disabled={summarySuggestion.meeting_content.length === 0}
                  >
                    반영
                  </button>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                  {summarySuggestion.meeting_content.map((item, index) => (
                    <li key={`content-${index}`} style={{ whiteSpace: 'pre-wrap' }}>
                      {displaySuggestionItem(item)}
                    </li>
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
                    onClick={() => applySuggestionForSection('meeting_result')}
                    disabled={summarySuggestion.meeting_result.length === 0}
                  >
                    반영
                  </button>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                  {summarySuggestion.meeting_result.map((item, index) => (
                    <li key={`result-${index}`}>{displaySuggestionItem(item)}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)' }}>
              반영 버튼을 누르면 해당 섹션에 제안이 바로 병합됩니다. 반영하지 않으면 참고해서 직접
              붙여넣어 주세요.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

export default MinutesPage;
