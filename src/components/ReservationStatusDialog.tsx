import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { format, parse, startOfDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h += 1) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 18) slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
})();

function getBulletPrefix(level: number) {
  const normalized = Math.max(0, Math.min(level, BULLET_SYMBOLS.length - 1));
  return `${BULLET_SYMBOLS[normalized]} `;
}

type ReservationStatus = {
  id: string;
  title: string;
  label: string;
  attendees: AppUser[];
  externalAttendees: string;
  agenda: string;
  meetingContent: string;
  meetingResult: string;
  minutesAttachment: string;
  start: Date;
  end: Date;
  creatorEmail: string;
  creatorName?: string;
};

type ReservationStatusDialogProps = {
  isOpen: boolean;
  reservation: ReservationStatus | null;
  users: AppUser[];
  labelOptions: string[];
  occupiedRanges: Array<{ start: Date; end: Date }>;
  onClose: () => void;
  onSave: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>
  ) => Promise<void> | void;
  onDelete: (reservationId: string) => void;
};

function ReservationStatusDialog({
  isOpen,
  reservation,
  users,
  labelOptions,
  occupiedRanges,
  onClose,
  onSave,
  onDelete,
}: ReservationStatusDialogProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);
  const [externalAttendees, setExternalAttendees] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  useEffect(() => {
    if (!reservation) return;
    setIsEditing(false);
    setSelectedLabel(reservation.label ?? '');
    setTitle(reservation.title ?? '');
    setSelectedAttendees(reservation.attendees ?? []);
    setExternalAttendees(reservation.externalAttendees ?? '');
    setAgenda(reservation.agenda ?? '');
    setAttendeeQuery('');
    setSelectedDate(reservation.start);
    setStartTime(
      TIME_SLOTS.includes(format(reservation.start, 'HH:mm'))
        ? format(reservation.start, 'HH:mm')
        : '09:00'
    );
    setEndTime(
      TIME_SLOTS.includes(format(reservation.end, 'HH:mm'))
        ? format(reservation.end, 'HH:mm')
        : '10:00'
    );
    setIsSelectingEnd(false);
  }, [reservation, isOpen]);

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

  const isRangeBlocked = useMemo(() => {
    if (!reservation) {
      return () => false;
    }
    return (start: Date, end: Date) =>
      occupiedRanges
        .filter(
          (item) =>
            item.start.getTime() !== reservation.start.getTime() ||
            item.end.getTime() !== reservation.end.getTime()
        )
        .some((item) => start < item.end && item.start < end);
  }, [occupiedRanges, reservation]);

  const blockedStartSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>();
    const locked = new Set<string>();
    for (let i = 0; i < TIME_SLOTS.length - 1; i += 1) {
      const segmentStart = parse(TIME_SLOTS[i], 'HH:mm', selectedDate);
      const segmentEnd = parse(TIME_SLOTS[i + 1], 'HH:mm', selectedDate);
      if (isRangeBlocked(segmentStart, segmentEnd)) {
        locked.add(TIME_SLOTS[i]);
      }
    }
    return locked;
  }, [isRangeBlocked, selectedDate]);

  useEffect(() => {
    if (!selectedDate || !isEditing) return;
    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);
    if (end <= start || isRangeBlocked(start, end) || blockedStartSlots.has(startTime)) {
      for (let i = 0; i < TIME_SLOTS.length - 2; i += 1) {
        const candidateStart = TIME_SLOTS[i];
        if (blockedStartSlots.has(candidateStart)) continue;
        const candidateEnd = TIME_SLOTS[i + 2];
        const rangeStart = parse(candidateStart, 'HH:mm', selectedDate);
        const rangeEnd = parse(candidateEnd, 'HH:mm', selectedDate);
        if (!isRangeBlocked(rangeStart, rangeEnd)) {
          setStartTime(candidateStart);
          setEndTime(candidateEnd);
          setIsSelectingEnd(false);
          return;
        }
      }
    }
  }, [blockedStartSlots, endTime, isEditing, isRangeBlocked, selectedDate, startTime]);

  if (!reservation) return null;

  const handleSave = async () => {
    if (!title.trim() || !selectedDate) return;
    const nextStart = parse(startTime, 'HH:mm', selectedDate);
    const nextEnd = parse(endTime, 'HH:mm', selectedDate);
    if (nextEnd <= nextStart) {
      alert('종료시간은 시작시간보다 커야 합니다.');
      return;
    }
    if (isRangeBlocked(nextStart, nextEnd)) {
      alert('이미 예약된 시간대를 포함할 수 없습니다.');
      return;
    }

    try {
      await onSave(reservation.id, {
        title: title.trim(),
        label: selectedLabel,
        attendees: selectedAttendees,
        externalAttendees: externalAttendees.trim(),
        agenda: agenda.trim(),
        meetingContent: reservation.meetingContent,
        meetingResult: reservation.meetingResult,
        minutesAttachment: reservation.minutesAttachment,
        start: nextStart,
        end: nextEnd,
      });
      setIsEditing(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '예약 수정에 실패했습니다.');
    }
  };

  const handleTimeClick = (slot: string) => {
    if (!selectedDate) return;
    const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];

    if (!isSelectingEnd) {
      if (slot === lastSlot) {
        const currentStart = parse(startTime, 'HH:mm', selectedDate);
        const candidateEnd = parse(lastSlot, 'HH:mm', selectedDate);
        if (candidateEnd > currentStart && !isRangeBlocked(currentStart, candidateEnd)) {
          setEndTime(lastSlot);
          setIsSelectingEnd(false);
        }
        return;
      }
      if (blockedStartSlots.has(slot)) return;
      const idx = TIME_SLOTS.indexOf(slot);
      if (idx < 0) return;
      let candidateEnd =
        slot >= endTime ? TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)] : endTime;
      const rangeStart = parse(slot, 'HH:mm', selectedDate);
      const rangeEnd = parse(candidateEnd, 'HH:mm', selectedDate);
      if (rangeEnd <= rangeStart || isRangeBlocked(rangeStart, rangeEnd)) {
        let found = false;
        for (let endIdx = idx + 1; endIdx < TIME_SLOTS.length; endIdx += 1) {
          const testEnd = TIME_SLOTS[endIdx];
          const testEndDate = parse(testEnd, 'HH:mm', selectedDate);
          if (testEndDate <= rangeStart) continue;
          if (!isRangeBlocked(rangeStart, testEndDate)) {
            candidateEnd = testEnd;
            found = true;
            break;
          }
        }
        if (!found) {
          alert('선택한 시작 시간 이후에 비어있는 구간이 없습니다.');
          return;
        }
      }
      setStartTime(slot);
      setEndTime(candidateEnd);
      setIsSelectingEnd(true);
    } else {
      if (slot > startTime) {
        const nextStart = parse(startTime, 'HH:mm', selectedDate);
        const nextEnd = parse(slot, 'HH:mm', selectedDate);
        if (isRangeBlocked(nextStart, nextEnd)) {
          alert('이미 예약된 시간대를 포함할 수 없습니다.');
          return;
        }
        setEndTime(slot);
        setIsSelectingEnd(false);
      } else {
        if (blockedStartSlots.has(slot)) return;
        const idx = TIME_SLOTS.indexOf(slot);
        if (idx < 0) return;
        let candidateEnd =
          slot >= endTime ? TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)] : endTime;
        const rangeStart = parse(slot, 'HH:mm', selectedDate);
        let found = false;
        for (let endIdx = idx + 1; endIdx < TIME_SLOTS.length; endIdx += 1) {
          const testEnd = TIME_SLOTS[endIdx];
          const testEndDate = parse(testEnd, 'HH:mm', selectedDate);
          if (testEndDate <= rangeStart) continue;
          if (!isRangeBlocked(rangeStart, testEndDate)) {
            candidateEnd = testEnd;
            found = true;
            break;
          }
        }
        if (!found) {
          alert('선택한 시작 시간 이후에 비어있는 구간이 없습니다.');
          return;
        }
        setStartTime(slot);
        setEndTime(candidateEnd);
        setIsSelectingEnd(true);
      }
    }
  };

  const handleAgendaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextLineBreakIndex = value.indexOf('\n', selectionStart);
    const lineEnd = nextLineBreakIndex === -1 ? value.length : nextLineBreakIndex;
    const line = value.slice(lineStart, lineEnd);
    const lineBeforeCursor = value.slice(lineStart, selectionStart);

    const setAgendaWithCursor = (nextValue: string, cursor: number) => {
      setAgenda(nextValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    };

    if (event.key === '-') {
      if (selectionStart !== selectionEnd) return;
      if (!/^\t*$/.test(lineBeforeCursor)) return;
      event.preventDefault();
      const bullet = getBulletPrefix(Math.min(lineBeforeCursor.length, MAX_BULLET_LEVEL - 1));
      const nextValue = `${value.slice(0, selectionStart)}${bullet}${value.slice(selectionEnd)}`;
      setAgendaWithCursor(nextValue, selectionStart + bullet.length);
      return;
    }

    if (event.key === 'Enter') {
      const bulletMatch = line.match(BULLET_PATTERN);
      if (!bulletMatch) return;
      event.preventDefault();
      const indent = bulletMatch[1] ?? '';
      const insert = `\n${indent}${getBulletPrefix(indent.length)}`;
      const nextValue = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
      setAgendaWithCursor(nextValue, selectionStart + insert.length);
      return;
    }

    if (event.key !== 'Tab') return;
    event.preventDefault();

    if (event.shiftKey) {
      const indentMatch = line.match(/^(\t{1,3})([•◦▪▫])\s?(.*)$/);
      if (indentMatch) {
        const nextIndent = indentMatch[1].slice(0, -1);
        const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${indentMatch[3]}`;
        const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
        setAgendaWithCursor(nextValue, Math.max(lineStart, selectionStart - 1));
        return;
      }

      const bulletMatch = line.match(/^([•◦▪▫])\s?(.*)$/);
      if (bulletMatch) {
        const nextLine = bulletMatch[2];
        const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
        setAgendaWithCursor(nextValue, Math.max(lineStart, selectionStart - 2));
      }
      return;
    }

    const nestedMatch = line.match(BULLET_PATTERN);
    if (nestedMatch) {
      const nextIndent = `${nestedMatch[1]}\t`;
      if (nextIndent.length >= MAX_BULLET_LEVEL) return;
      const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${nestedMatch[3]}`;
      const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
      setAgendaWithCursor(nextValue, selectionStart + 1);
      return;
    }

    const plainLineMatch = line.match(/^(\t{0,4})(.*)$/);
    if (plainLineMatch) {
      const indent = plainLineMatch[1].slice(0, MAX_BULLET_LEVEL - 1);
      const bullet = getBulletPrefix(indent.length);
      const nextLine = `${indent}${bullet}${plainLineMatch[2]}`;
      const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
      setAgendaWithCursor(nextValue, selectionStart + bullet.length);
    }
  };

  if (isEditing) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        contentClassName="reservation-dialog-card"
        showCloseButton
      >
        <div className="reservation-dialog-grid">
          <aside className="reservation-sidebar-picker">
            <div className="status-info-group">
              <label className="status-info-label">날짜 선택</label>
              <DayPicker
                className="reservation-day-picker"
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ko}
                weekStartsOn={1}
                disabled={{ before: startOfDay(new Date()) }}
                hidden={{ dayOfWeek: [0, 6] }}
              />
            </div>
            <div className="time-slots-wrapper">
              <label className="status-info-label">시간 선택</label>
              <div className="time-slots-grid">
                {TIME_SLOTS.map((slot) => {
                  const isStart = startTime === slot;
                  const isEnd = endTime === slot;
                  const isInRange = slot > startTime && slot < endTime;
                  const isDisabled = !isSelectingEnd && blockedStartSlots.has(slot);

                  return (
                    <button
                      key={slot}
                      className={`time-slot-button ${isStart ? 'active start-edge' : ''} ${isEnd ? 'active end-edge' : ''} ${isInRange ? 'in-range' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => handleTimeClick(slot)}
                      aria-disabled={isDisabled}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="reservation-main-fields">
            <div className="status-card-header">
              <h2
                style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}
              >
                예약 수정
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span className="status-badge">
                  {selectedDate?.toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
                <span
                  className="status-badge"
                  style={{ background: 'rgba(94, 106, 210, 0.06)', color: 'var(--accent)' }}
                >
                  {startTime} - {endTime}
                </span>
              </div>
            </div>

            <div className="status-card-body">
              <div className="status-info-group">
                <label className="status-info-label">라벨</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {labelOptions.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="room-capacity-tag"
                      style={{
                        background:
                          selectedLabel === label ? 'rgba(94, 106, 210, 0.12)' : undefined,
                        color: selectedLabel === label ? 'var(--accent)' : undefined,
                      }}
                      onClick={() => setSelectedLabel(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="status-info-group">
                <label className="status-info-label">회의 제목</label>
                <input
                  className="linear-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="회의 제목을 입력하세요"
                  autoFocus
                />
              </div>

              <div className="status-info-group">
                <label className="status-info-label">내부 참석자</label>
                <div className="attendee-token-input">
                  {selectedAttendees.map((a) => (
                    <span
                      key={a.id}
                      className="room-capacity-tag"
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setSelectedAttendees((prev) => prev.filter((item) => item.id !== a.id))
                      }
                    >
                      {a.name} ✕
                    </span>
                  ))}
                  <input
                    className="attendee-token-field"
                    value={attendeeQuery}
                    placeholder={selectedAttendees.length === 0 ? '이름 입력...' : ''}
                    onChange={(e) => setAttendeeQuery(e.target.value)}
                  />
                </div>
                {filteredUsers.length > 0 && (
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
                    {filteredUsers.slice(0, 4).map((u) => (
                      <button
                        key={u.id}
                        className="popover-item"
                        onClick={() => {
                          setSelectedAttendees((prev) => [...prev, u]);
                          setAttendeeQuery('');
                        }}
                      >
                        {u.name} ({u.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="status-info-group">
                <label className="status-info-label">외부 참석자</label>
                <input
                  className="linear-input"
                  value={externalAttendees}
                  placeholder="외부 참석자를 입력하세요"
                  onChange={(e) => setExternalAttendees(e.target.value)}
                />
              </div>
              <div className="status-info-group">
                <label className="status-info-label">주요 안건</label>
                <textarea
                  className="minutes-textarea"
                  style={{ minHeight: '140px', padding: '12px', fontSize: '14px', resize: 'none' }}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  onKeyDown={handleAgendaKeyDown}
                />
              </div>
            </div>

            <div className="status-card-footer" style={{ flexWrap: 'wrap' }}>
              <button
                className="nav-menu-item"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => setIsEditing(false)}
              >
                취소
              </button>
              <button
                className="linear-primary-button"
                style={{
                  width: 'auto',
                  minWidth: '96px',
                  padding: '0 24px',
                  marginTop: 0,
                  whiteSpace: 'nowrap',
                }}
                onClick={() => {
                  void handleSave();
                }}
                disabled={!title.trim() || !selectedDate}
              >
                저장
              </button>
            </div>
          </main>
        </div>
      </Dialog>
    );
  }

  const timeRange = `${reservation.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${reservation.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="reservation-status-dialog-card"
      showCloseButton
    >
      <div className="status-card-header">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span className="status-badge">
            {reservation.start.toLocaleDateString('ko-KR', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </span>
          <span
            className="status-badge"
            style={{ background: 'rgba(16, 18, 24, 0.04)', color: 'var(--text-soft)' }}
          >
            {timeRange}
          </span>
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
          {reservation.title}
        </h2>
      </div>

      <div className="status-card-body">
        <div className="status-info-group">
          <span className="status-info-label">라벨</span>
          <span className="room-capacity-tag" style={{ width: 'fit-content' }}>
            {reservation.label || '-'}
          </span>
        </div>
        <div className="status-info-group">
          <span className="status-info-label">예약자</span>
          <span className="status-info-value" style={{ fontWeight: 600 }}>
            {reservation.creatorName || reservation.creatorEmail.split('@')[0]}
          </span>
        </div>
        <div className="status-info-group">
          <span className="status-info-label">내부 참석자</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {reservation.attendees.map((a) => (
              <span key={a.id} className="room-capacity-tag" style={{ padding: '4px 10px' }}>
                {a.name}
              </span>
            ))}
            {reservation.attendees.length === 0 && <span className="status-info-value">없음</span>}
          </div>
        </div>
        <div className="status-info-group">
          <span className="status-info-label">외부 참석자</span>
          <p className="status-info-value">{reservation.externalAttendees || '없음'}</p>
        </div>
        <div className="status-info-group">
          <span className="status-info-label">주요 안건</span>
          <p className="status-info-value">{reservation.agenda || '작성된 안건이 없습니다.'}</p>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/minutes/${reservation.id}`);
            }}
            style={{
              marginTop: '6px',
              alignSelf: 'flex-start',
              border: 'none',
              background: 'transparent',
              color: '#6b563e',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            [회의록 보기]
          </button>
        </div>
      </div>

      <div className="status-card-footer">
        <button className="nav-menu-item" onClick={() => setIsEditing(true)}>
          예약 수정
        </button>
        <button
          className="nav-menu-item"
          style={{ color: '#e5484d' }}
          onClick={() => {
            onDelete(reservation.id);
            onClose();
          }}
        >
          예약 취소
        </button>
        <button
          className="linear-primary-button"
          style={{ width: 'auto', padding: '0 24px' }}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </Dialog>
  );
}

export default ReservationStatusDialog;
export type { ReservationStatus };
