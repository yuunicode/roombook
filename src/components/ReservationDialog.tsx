import { useEffect, useMemo, useState } from 'react';
import { format, parse, startOfDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

type ReservationDraft = {
  title: string;
  start: Date;
  end: Date;
  attendees: AppUser[];
  agenda: string;
  minutesAttachment: string;
};

type ReservationDialogProps = {
  isOpen: boolean;
  initialStart: Date;
  initialEnd: Date;
  currentUser: AppUser | null;
  users: AppUser[];
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

function ReservationDialog({
  isOpen,
  initialStart,
  initialEnd,
  currentUser,
  users,
  onClose,
  onConfirm,
}: ReservationDialogProps) {
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialStart);
  const [startTime, setStartTime] = useState(format(initialStart, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(initialEnd, 'HH:mm'));
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAgenda('');
      setAttendeeQuery('');
      setSelectedAttendees(currentUser ? [currentUser] : []);
      setSelectedDate(initialStart);

      // Ensure initial times are within our 09:00-18:00 bounds for the UI
      const startStr = format(initialStart, 'HH:mm');
      const endStr = format(initialEnd, 'HH:mm');
      setStartTime(TIME_SLOTS.includes(startStr) ? startStr : '09:00');
      setEndTime(TIME_SLOTS.includes(endStr) ? endStr : '10:00');
      setIsSelectingEnd(false);
    }
  }, [isOpen, currentUser, initialStart, initialEnd]);

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) return [];
    return users.filter(u => !selectedAttendees.some(a => a.id === u.id) && (u.name.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword)));
  }, [attendeeQuery, selectedAttendees, users]);

  const handleConfirm = () => {
    if (!title.trim() || !selectedDate) return;

    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);

    onConfirm({
      title: title.trim(),
      start,
      end,
      attendees: selectedAttendees,
      agenda: agenda.trim(),
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

  return (
    <Dialog isOpen={isOpen} onClose={onClose} contentClassName="reservation-dialog-card" showCloseButton>
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
              {TIME_SLOTS.map(slot => {
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
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>새 회의 예약</h2>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <span className="status-badge">
                {selectedDate?.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              </span>
              <span className="status-badge" style={{ background: 'rgba(94, 106, 210, 0.06)', color: 'var(--accent)' }}>
                {startTime} - {endTime}
              </span>
            </div>
          </div>

          <div className="status-card-body">
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
              <label className="status-info-label">참석자 초대</label>
              <input
                className="linear-input"
                style={{ marginBottom: '8px' }}
                value={attendeeQuery}
                placeholder="이름 또는 이메일 검색..."
                onChange={(e) => setAttendeeQuery(e.target.value)}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedAttendees.map(a => (
                  <span
                    key={a.id}
                    className="room-capacity-tag"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedAttendees(prev => prev.filter(item => item.id !== a.id))}
                  >
                    {a.name} ✕
                  </span>
                ))}
              </div>
              {filteredUsers.length > 0 && (
                <div className="user-dropdown-popover" style={{ position: 'static', width: '100%', marginTop: '8px', boxShadow: 'none', border: '1px solid var(--border)' }}>
                  {filteredUsers.slice(0, 4).map(u => (
                    <button
                      key={u.id}
                      className="popover-item"
                      onClick={() => { setSelectedAttendees(prev => [...prev, u]); setAttendeeQuery(''); }}
                    >
                      {u.name} ({u.email})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="status-info-group">
              <label className="status-info-label">회의 안건</label>
              <textarea
                className="minutes-textarea"
                style={{ minHeight: '120px', padding: '12px', fontSize: '14px' }}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="안건을 입력하세요"
              />
            </div>
          </div>

          <div className="status-card-footer">
            <button className="nav-menu-item" onClick={onClose}>취소</button>
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 24px', marginTop: 0 }}
              onClick={handleConfirm}
              disabled={!title.trim() || !selectedDate}
            >
              예약 완료
            </button>
          </div>
        </main>
      </div>
    </Dialog>
  );
}

export default ReservationDialog;
export type { ReservationDraft };
