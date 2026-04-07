import { useEffect, useMemo, useState } from 'react';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

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
    if (!reservation) {
      return;
    }
    setIsEditing(false);
    setTitle(reservation.title ?? '');
    setSelectedAttendees(reservation.attendees ?? []);
    setAttendeeQuery('');
    setAgenda(reservation.agenda ?? '');
    setMinutesAttachment(reservation.minutesAttachment ?? '');
  }, [reservation, isOpen]);

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return users.filter((user) => {
      if (selectedAttendees.some((attendee) => attendee.id === user.id)) {
        return false;
      }
      return (
        user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)
      );
    });
  }, [attendeeQuery, selectedAttendees, users]);

  if (!reservation) {
    return null;
  }

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
    if (!title.trim()) {
      return;
    }

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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="reservation-status-title"
      contentClassName="reservation-status-dialog-card"
      showCloseButton
      closeButtonClassName="reservation-close-button"
    >
      <div className="reservation-status-content">
        <h2 id="reservation-status-title" className="reservation-dialog-title">
          예약 현황
        </h2>
        <p className="reservation-status-time">
          {reservation.start.toLocaleDateString('ko-KR')} {reservation.start.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}{' '}
          ~{' '}
          {reservation.end.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </p>

        {isEditing ? (
          <>
            <label className="reservation-label" htmlFor="status-title">
              회의 제목
            </label>
            <input
              id="status-title"
              className="reservation-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <label className="reservation-label" htmlFor="status-attendees">
              참석자
            </label>
            <input
              id="status-attendees"
              className="reservation-input"
              value={attendeeQuery}
              placeholder="이름으로 검색하세요"
              onChange={(event) => setAttendeeQuery(event.target.value)}
            />
            <div className="reservation-attendee-chip-list">
              {selectedAttendees.map((attendee) => (
                <button
                  key={attendee.id}
                  className="reservation-attendee-chip"
                  type="button"
                  onClick={() =>
                    setSelectedAttendees((previous) =>
                      previous.filter((item) => item.id !== attendee.id)
                    )
                  }
                >
                  {attendee.name}
                </button>
              ))}
            </div>
            <div className="reservation-attendee-suggestions">
              {filteredUsers.slice(0, 6).map((user) => (
                <button
                  key={user.id}
                  className="reservation-attendee-option"
                  type="button"
                  onClick={() => {
                    setSelectedAttendees((previous) => [...previous, user]);
                    setAttendeeQuery('');
                  }}
                >
                  <span>{user.name}</span>
                  <span>{user.email}</span>
                </button>
              ))}
            </div>

            <label className="reservation-label" htmlFor="status-agenda">
              회의 안건
            </label>
            <textarea
              id="status-agenda"
              className="reservation-textarea reservation-agenda-textarea"
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
            />

            <label className="reservation-label" htmlFor="status-minutes">
              첨부파일
            </label>
            <input
              id="status-minutes"
              className="reservation-input"
              placeholder="파일명 또는 링크"
              value={minutesAttachment}
              onChange={(event) => setMinutesAttachment(event.target.value)}
            />
            <input
              className="reservation-file-input"
              type="file"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) {
                  setMinutesAttachment(selectedFile.name);
                }
              }}
            />
          </>
        ) : (
          <div className="reservation-status-fields">
            <div className="reservation-status-field">
              <span className="reservation-status-label">예약자</span>
              <p className="reservation-status-value">{reserverName}</p>
            </div>
            <div className="reservation-status-field">
              <span className="reservation-status-label">회의 제목</span>
              <p className="reservation-status-value">{reservation.title}</p>
            </div>
            <div className="reservation-status-field">
              <span className="reservation-status-label">참석자</span>
              <p className="reservation-status-value">
                {reservation.attendees.map((attendee) => attendee.name).join(', ') || '없음'}
              </p>
            </div>
            <div className="reservation-status-field">
              <span className="reservation-status-label">회의 안건</span>
              <p className="reservation-status-value">{reservation.agenda || '없음'}</p>
            </div>
            <div className="reservation-status-field">
              <span className="reservation-status-label">첨부파일</span>
              <p className="reservation-status-value">{reservation.minutesAttachment || '없음'}</p>
            </div>
          </div>
        )}

        <div className="reservation-actions">
          {isEditing ? (
            <>
              <button className="secondary-button" type="button" onClick={() => setIsEditing(false)}>
                편집 취소
              </button>
              <button className="primary-button" type="button" onClick={handleSave} disabled={!title.trim()}>
                저장
              </button>
            </>
          ) : (
            <>
              {canManage ? (
                <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
                  수정
                </button>
              ) : null}
              {canManage ? (
                <button
                  className="secondary-button danger-button"
                  type="button"
                  onClick={() => {
                    onDelete(reservation.id);
                    onClose();
                  }}
                >
                  취소
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default ReservationStatusDialog;
export type { ReservationStatus };
