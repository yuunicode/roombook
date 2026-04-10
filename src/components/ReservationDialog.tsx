import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { format, parse, startOfDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

type ReservationDraft = {
  title: string;
  label: string;
  start: Date;
  end: Date;
  attendees: AppUser[];
  externalAttendees: string;
  agenda: string;
  meetingContent: string;
  meetingResult: string;
  minutesAttachment: string;
};

type ReservationDialogProps = {
  isOpen: boolean;
  initialStart: Date;
  initialEnd: Date;
  currentUser: AppUser | null;
  users: AppUser[];
  labelOptions: string[];
  onClose: () => void;
  onConfirm: (draft: ReservationDraft) => void;
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 18) slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
})();

const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;

function getBulletPrefix(level: number) {
  const normalized = Math.max(0, Math.min(level, BULLET_SYMBOLS.length - 1));
  return `${BULLET_SYMBOLS[normalized]} `;
}

function ReservationDialog({
  isOpen,
  initialStart,
  initialEnd,
  currentUser,
  users,
  labelOptions,
  onClose,
  onConfirm,
}: ReservationDialogProps) {
  const [selectedLabel, setSelectedLabel] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);
  const [externalAttendees, setExternalAttendees] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialStart);
  const [startTime, setStartTime] = useState(format(initialStart, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(initialEnd, 'HH:mm'));
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelectedLabel(labelOptions[0] ?? '');
      setAgenda('');
      setAttendeeQuery('');
      setSelectedAttendees(currentUser ? [currentUser] : []);
      setExternalAttendees('');
      setSelectedDate(initialStart);

      // Ensure initial times are within our 09:00-18:00 bounds for the UI
      const startStr = format(initialStart, 'HH:mm');
      const endStr = format(initialEnd, 'HH:mm');
      setStartTime(TIME_SLOTS.includes(startStr) ? startStr : '09:00');
      setEndTime(TIME_SLOTS.includes(endStr) ? endStr : '10:00');
      setIsSelectingEnd(false);
    }
  }, [isOpen, currentUser, initialStart, initialEnd, labelOptions]);

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

  const handleConfirm = () => {
    if (!title.trim() || !selectedDate) return;

    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);

    onConfirm({
      title: title.trim(),
      label: selectedLabel,
      start,
      end,
      attendees: selectedAttendees,
      externalAttendees: externalAttendees.trim(),
      agenda: agenda.trim(),
      meetingContent: '',
      meetingResult: '',
      minutesAttachment: '',
    });
  };

  const handleTimeClick = (slot: string) => {
    if (!isSelectingEnd) {
      // Start a new selection or update start point
      setStartTime(slot);
      if (slot >= endTime) {
        const idx = TIME_SLOTS.indexOf(slot);
        setEndTime(TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)]);
      }
      setIsSelectingEnd(true);
    } else {
      // Finish range selection
      if (slot > startTime) {
        setEndTime(slot);
        setIsSelectingEnd(false);
      } else {
        // Clicked before current start, treat as setting a new start
        setStartTime(slot);
        if (slot >= endTime) {
          const idx = TIME_SLOTS.indexOf(slot);
          setEndTime(TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)]);
        }
        setIsSelectingEnd(true);
      }
    }
  };

  const handleAgendaKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
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
  }, []);

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

                return (
                  <button
                    key={slot}
                    className={`time-slot-button ${isStart ? 'active start-edge' : ''} ${isEnd ? 'active end-edge' : ''} ${isInRange ? 'in-range' : ''}`}
                    onClick={() => handleTimeClick(slot)}
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
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
              새 회의 예약
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
                      background: selectedLabel === label ? 'rgba(94, 106, 210, 0.12)' : undefined,
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
                onChange={(e) => setExternalAttendees(e.target.value)}
                placeholder="외부 참석자를 입력하세요"
              />
            </div>

            <div className="status-info-group">
              <label className="status-info-label">주요 안건</label>
              <textarea
                className="minutes-textarea"
                style={{ minHeight: '120px', padding: '12px', fontSize: '14px', resize: 'none' }}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                onKeyDown={handleAgendaKeyDown}
                placeholder="주요 안건을 입력하세요"
              />
            </div>
          </div>

          <div className="status-card-footer" style={{ flexWrap: 'wrap' }}>
            <button className="nav-menu-item" style={{ whiteSpace: 'nowrap' }} onClick={onClose}>
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
              onClick={handleConfirm}
              disabled={!title.trim() || !selectedDate}
            >
              예약하기
            </button>
          </div>
        </main>
      </div>
    </Dialog>
  );
}

export default ReservationDialog;
export type { ReservationDraft };
