import { useEffect, useMemo, useState } from 'react';
import { format, parse, startOfDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '../stores';
import { formatAgendaMultiline } from '../utils/minutesText';
import {
  TIME_SLOTS,
  filterReservationUsers,
  useAgendaBulletKeyDown,
  useReservationTimeSelection,
} from './reservationDialogUtils';
import Dialog from './ui/Dialog';

type ReservationStatus = {
  id: string;
  title: string;
  label: string;
  attendees: AppUser[];
  externalAttendees: string;
  agenda: string;
  meetingContent: string;
  meetingResult: string;
  otherNotes: string;
  minutesAttachment: string;
  start: Date;
  end: Date;
  creatorEmail: string;
  creatorName?: string;
};

type ReservationStatusDialogProps = {
  isOpen: boolean;
  reservation: ReservationStatus | null;
  currentUser: AppUser | null;
  users: AppUser[];
  labelOptions: string[];
  occupiedRanges: Array<{ start: Date; end: Date }>;
  onClose: () => void;
  onSave: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>
  ) => Promise<void> | void;
  onDelete: (reservationId: string) => Promise<void> | void;
};

function ReservationStatusDialog({
  isOpen,
  reservation,
  currentUser,
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

  const filteredUsers = useMemo(
    () => filterReservationUsers(attendeeQuery, selectedAttendees, users),
    [attendeeQuery, selectedAttendees, users]
  );

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

  const { blockedStartSlots, blockedEndSlots, handleTimeClick, resetTimeSelection } =
    useReservationTimeSelection({
      selectedDate,
      startTime,
      endTime,
      isSelectingEnd,
      isRangeBlocked,
      setStartTime,
      setEndTime,
      setIsSelectingEnd,
      enabled: isEditing,
    });
  const handleAgendaKeyDown = useAgendaBulletKeyDown(setAgenda);
  const selectedTimeLabel =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime
        ? `${startTime} 이후 종료시간 선택`
        : '시작시간 선택';

  if (!reservation) return null;

  const canManageReservation =
    currentUser !== null &&
    (reservation.creatorEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      reservation.attendees.some((attendee) => attendee.id === currentUser.id));
  const editForbiddenMessage = '예약자 또는 내부 참석자만 예약을 수정할 수 있습니다.';
  const deleteForbiddenMessage = '예약자 또는 내부 참석자만 예약을 취소할 수 있습니다.';

  const handleSave = async () => {
    if (!title.trim() || !selectedDate) return;
    if (!canManageReservation) {
      alert(editForbiddenMessage);
      return;
    }
    if (!startTime || !endTime) {
      alert('시작시간과 종료시간을 선택해 주세요.');
      return;
    }
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
        otherNotes: reservation.otherNotes,
        minutesAttachment: reservation.minutesAttachment,
        start: nextStart,
        end: nextEnd,
      });
      setIsEditing(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '예약 수정에 실패했습니다.');
    }
  };

  const handleStartEdit = () => {
    if (!canManageReservation) {
      alert(editForbiddenMessage);
      return;
    }
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!canManageReservation) {
      alert(deleteForbiddenMessage);
      return;
    }

    try {
      await onDelete(reservation.id);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : '예약 취소에 실패했습니다.');
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
              <div className="time-slots-header">
                <label className="status-info-label">시간 선택</label>
                <button
                  type="button"
                  className="time-slots-reset-button"
                  onClick={resetTimeSelection}
                  disabled={!startTime && !endTime && !isSelectingEnd}
                >
                  리셋
                </button>
              </div>
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

            <div
              className="status-card-footer reservation-card-footer"
              style={{ flexWrap: 'wrap' }}
            >
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
                  minWidth: '88px',
                  padding: '0 18px',
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
          <p className="status-info-value" style={{ whiteSpace: 'pre-wrap' }}>
            {formatAgendaMultiline(reservation.agenda) || '작성된 안건이 없습니다.'}
          </p>
        </div>
      </div>

      <div className="status-card-footer reservation-card-footer">
        <button
          className="nav-menu-item"
          onClick={() => {
            onClose();
            navigate(`/minutes/${reservation.id}`);
          }}
        >
          회의록 보기
        </button>
        <button className="nav-menu-item" onClick={handleStartEdit}>
          예약 수정
        </button>
        <button
          className="nav-menu-item"
          style={{ color: '#e5484d' }}
          onClick={() => {
            void handleDelete();
          }}
        >
          예약 취소
        </button>
        <button
          className="linear-primary-button"
          style={{ width: 'auto', minWidth: '72px', padding: '0 18px' }}
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
