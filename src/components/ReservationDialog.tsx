import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import type { AppUser } from '../stores';
import {
  TIME_SLOTS,
  filterReservationUsers,
  useAgendaBulletKeyDown,
  useReservationTimeSelection,
} from './reservationDialogUtils';
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
  otherNotes: string;
  minutesAttachment: string;
};

type ReservationDialogProps = {
  isOpen: boolean;
  initialStart: Date;
  initialEnd: Date;
  startWithEmptyTimeSelection?: boolean;
  currentUser: AppUser | null;
  users: AppUser[];
  labelOptions: string[];
  occupiedRanges: Array<{ start: Date; end: Date }>;
  onClose: () => void;
  onConfirm: (draft: ReservationDraft) => Promise<void> | void;
};

function ReservationDialog({
  isOpen,
  initialStart,
  initialEnd,
  startWithEmptyTimeSelection = false,
  currentUser,
  users,
  labelOptions,
  occupiedRanges,
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

      if (startWithEmptyTimeSelection) {
        setStartTime('');
        setEndTime('');
        setIsSelectingEnd(false);
        return;
      }

      // Ensure initial times are within our 09:00-18:00 bounds for the UI
      const startStr = format(initialStart, 'HH:mm');
      const endStr = format(initialEnd, 'HH:mm');
      setStartTime(TIME_SLOTS.includes(startStr) ? startStr : '09:00');
      setEndTime(TIME_SLOTS.includes(endStr) ? endStr : '10:00');
      setIsSelectingEnd(false);
    }
  }, [isOpen, currentUser, initialStart, initialEnd, labelOptions, startWithEmptyTimeSelection]);

  const filteredUsers = useMemo(
    () => filterReservationUsers(attendeeQuery, selectedAttendees, users),
    [attendeeQuery, selectedAttendees, users]
  );

  const isRangeBlocked = useCallback(
    (start: Date, end: Date) => occupiedRanges.some((item) => start < item.end && item.start < end),
    [occupiedRanges]
  );

  const { blockedStartSlots, blockedEndSlots, handleTimeClick } = useReservationTimeSelection({
      selectedDate,
      startTime,
      endTime,
      isSelectingEnd,
      isRangeBlocked,
      setStartTime,
      setEndTime,
      setIsSelectingEnd,
    });

  const selectedTimeLabel =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime
        ? `${startTime} 이후 종료시간 선택`
        : '시작시간 선택';

  const handleConfirm = async () => {
    if (!title.trim() || !selectedDate) return;
    if (!startTime || !endTime) {
      alert('시작시간과 종료시간을 선택해 주세요.');
      return;
    }

    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);
    if (end <= start) {
      alert('종료시간은 시작시간보다 커야 합니다.');
      return;
    }
    if (isRangeBlocked(start, end)) {
      alert('이미 예약된 시간이 포함되어 있습니다.');
      return;
    }

    await onConfirm({
      title: title.trim(),
      label: selectedLabel,
      start,
      end,
      attendees: selectedAttendees,
      externalAttendees: externalAttendees.trim(),
      agenda: agenda.trim(),
      meetingContent: '',
      meetingResult: '',
      otherNotes: '',
      minutesAttachment: '',
    });
  };

  const handleAgendaKeyDown = useAgendaBulletKeyDown(setAgenda);

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
              hidden={{ dayOfWeek: [0, 6] }}
            />
          </div>

          <div className="time-slots-wrapper">
            <label className="status-info-label">시간 선택</label>
            <div className="time-slots-grid">
              {TIME_SLOTS.map((slot) => {
                const isStart = startTime === slot;
                const isEnd = endTime === slot;
                const isInRange =
                  Boolean(startTime && endTime) && slot > startTime && slot < endTime;
                const isDisabled = isSelectingEnd
                  ? blockedEndSlots.has(slot)
                  : blockedStartSlots.has(slot) && !isEnd;

                return (
                  <button
                    type="button"
                    key={slot}
                    className={`time-slot-button ${isStart ? 'active start-edge' : ''} ${isEnd ? 'active end-edge' : ''} ${isInRange ? 'in-range' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handleTimeClick(slot)}
                    disabled={isDisabled}
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
                {selectedTimeLabel}
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

          <div className="status-card-footer reservation-card-footer" style={{ flexWrap: 'wrap' }}>
            <button
              className="nav-menu-item"
              style={{ whiteSpace: 'nowrap', minWidth: '88px', justifyContent: 'center' }}
              onClick={onClose}
            >
              취소
            </button>
            <button
              className="linear-primary-button"
              style={{
                width: 'auto',
                minWidth: '88px',
                padding: '0 18px',
                marginTop: 0,
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                void handleConfirm();
              }}
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
