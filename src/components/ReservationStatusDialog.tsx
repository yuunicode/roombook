import { useEffect, useMemo, useState } from 'react';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';
import { AppIcon } from './index';

type ReservationStatus = {
  id: string;
  title: string;
  attendees: AppUser[];
  agenda: string;
  minutesAttachment: string;
  start: Date;
  end: Date;
  creatorEmail: string;
};

type ReservationStatusDialogProps = {
  isOpen: boolean;
  reservation: ReservationStatus | null;
  currentUserEmail: string;
  users: AppUser[];
  onClose: () => void;
  onSave: (reservationId: string, payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>) => void;
  onDelete: (reservationId: string) => void;
};

function ReservationStatusDialog({
  isOpen,
  reservation,
  currentUserEmail,
  users,
  onClose,
  onSave,
  onDelete,
}: ReservationStatusDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [minutesAttachment, setMinutesAttachment] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);

  useEffect(() => {
    if (!reservation) return;
    setIsEditing(false);
    setTitle(reservation.title ?? '');
    setSelectedAttendees(reservation.attendees ?? []);
    setAttendeeQuery('');
    setAgenda(reservation.agenda ?? '');
    setMinutesAttachment(reservation.minutesAttachment ?? '');
  }, [reservation, isOpen]);

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) return [];
    return users.filter((user) => {
      if (selectedAttendees.some((attendee) => attendee.id === user.id)) return false;
      return (
        user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)
      );
    });
  }, [attendeeQuery, selectedAttendees, users]);

  if (!reservation) return null;

  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const normalizedCreatorEmail = reservation.creatorEmail.trim().toLowerCase();
  const isAttendee = reservation.attendees.some(
    (attendee) => attendee.email.trim().toLowerCase() === normalizedCurrentUserEmail
  );
  const canManage = Boolean(
    normalizedCurrentUserEmail &&
    (normalizedCurrentUserEmail === normalizedCreatorEmail || isAttendee)
  );
  const reserverName = reservation.creatorEmail.split('@')[0] ?? reservation.creatorEmail;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(reservation.id, {
      title: title.trim(),
      attendees: selectedAttendees,
      agenda: agenda.trim(),
      minutesAttachment: minutesAttachment.trim(),
      start: reservation.start,
      end: reservation.end,
    });
    setIsEditing(false);
  };

  const timeRange = `${reservation.start.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} - ${reservation.end.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;

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
        {isEditing ? (
          <input
            className="linear-input"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              width: '100%',
              outline: 'none',
            }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
            {reservation.title}
          </h2>
        )}
      </div>

      <div className="status-card-body">
        {isEditing ? (
          <>
            <div className="status-info-group">
              <label className="status-info-label">참석자</label>
              <input
                className="linear-input"
                style={{ marginBottom: '8px' }}
                value={attendeeQuery}
                placeholder="참석자 검색 및 추가..."
                onChange={(e) => setAttendeeQuery(e.target.value)}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedAttendees.map((attendee) => (
                  <span
                    key={attendee.id}
                    className="room-capacity-tag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      setSelectedAttendees((prev) => prev.filter((a) => a.id !== attendee.id))
                    }
                  >
                    {attendee.name} ✕
                  </span>
                ))}
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

            <div className="status-info-group">
              <label className="status-info-label">회의 안건</label>
              <textarea
                className="minutes-textarea"
                style={{ minHeight: '140px', padding: '12px', fontSize: '14px' }}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="status-info-group">
              <span className="status-info-label">예약자</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  className="card-icon-box"
                  style={{ width: '28px', height: '28px', borderRadius: '8px' }}
                >
                  <AppIcon name="users" style={{ width: '14px', height: '14px' }} />
                </div>
                <span className="status-info-value" style={{ fontWeight: 600 }}>
                  {reserverName}
                </span>
              </div>
            </div>

            <div className="status-info-group">
              <span className="status-info-label">참석자</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {reservation.attendees.map((attendee) => (
                  <span
                    key={attendee.id}
                    className="room-capacity-tag"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    {attendee.name}
                  </span>
                ))}
                {reservation.attendees.length === 0 && (
                  <span className="status-info-value">없음</span>
                )}
              </div>
            </div>

            <div className="status-info-group">
              <span className="status-info-label">회의 안건</span>
              <p className="status-info-value">{reservation.agenda || '작성된 안건이 없습니다.'}</p>
            </div>

            {reservation.minutesAttachment && (
              <div className="status-info-group">
                <span className="status-info-label">첨부파일</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--accent)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <AppIcon name="calendar" style={{ width: '14px' }} />
                  <span style={{ textDecoration: 'underline' }}>
                    {reservation.minutesAttachment}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="status-card-footer">
        {isEditing ? (
          <>
            <button className="nav-menu-item" onClick={() => setIsEditing(false)}>
              취소
            </button>
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 24px', marginTop: 0 }}
              onClick={handleSave}
            >
              변경사항 저장
            </button>
          </>
        ) : (
          <>
            {canManage && (
              <>
                <button className="nav-menu-item" onClick={() => setIsEditing(true)}>
                  편집
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
              </>
            )}
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 24px', marginTop: 0 }}
              onClick={onClose}
            >
              확인
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}

export default ReservationStatusDialog;
export type { ReservationStatus };
