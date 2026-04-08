import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;

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
};

type ReservationStatusDialogProps = {
  isOpen: boolean;
  reservation: ReservationStatus | null;
  users: AppUser[];
  labelOptions: string[];
  onClose: () => void;
  onSave: (reservationId: string, payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>) => void;
  onDelete: (reservationId: string) => void;
};

function ReservationStatusDialog({
  isOpen,
  reservation,
  users,
  labelOptions,
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

  useEffect(() => {
    if (!reservation) return;
    setIsEditing(false);
    setSelectedLabel(reservation.label ?? '');
    setTitle(reservation.title ?? '');
    setSelectedAttendees(reservation.attendees ?? []);
    setExternalAttendees(reservation.externalAttendees ?? '');
    setAgenda(reservation.agenda ?? '');
  }, [reservation, isOpen]);

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) return [];
    return users.filter(
      (u) =>
        !selectedAttendees.some((a) => a.id === u.id) &&
        (u.name.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword))
    );
  }, [attendeeQuery, selectedAttendees, users]);

  if (!reservation) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(reservation.id, {
      title: title.trim(),
      label: selectedLabel,
      attendees: selectedAttendees,
      externalAttendees: externalAttendees.trim(),
      agenda: agenda.trim(),
      meetingContent: reservation.meetingContent,
      meetingResult: reservation.meetingResult,
      minutesAttachment: reservation.minutesAttachment,
      start: reservation.start,
      end: reservation.end,
    });
    setIsEditing(false);
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
        {isEditing ? (
          <input
            className="linear-input"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              border: 'none',
              background: 'transparent',
              padding: 0,
              width: '100%',
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
              <label className="status-info-label">내부 참석자</label>
              <input
                className="linear-input"
                style={{ marginBottom: '8px' }}
                value={attendeeQuery}
                placeholder="참석자 추가..."
                onChange={(e) => setAttendeeQuery(e.target.value)}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
          </>
        ) : (
          <>
            <div className="status-info-group">
              <span className="status-info-label">라벨</span>
              <span className="room-capacity-tag" style={{ width: 'fit-content' }}>
                {reservation.label || '-'}
              </span>
            </div>
            <div className="status-info-group">
              <span className="status-info-label">예약자</span>
              <span className="status-info-value" style={{ fontWeight: 600 }}>
                {reservation.creatorEmail.split('@')[0]}
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
                {reservation.attendees.length === 0 && (
                  <span className="status-info-value">없음</span>
                )}
              </div>
            </div>
            <div className="status-info-group">
              <span className="status-info-label">외부 참석자</span>
              <p className="status-info-value">{reservation.externalAttendees || '없음'}</p>
            </div>
            <div className="status-info-group">
              <span className="status-info-label">주요 안건</span>
              <p className="status-info-value">{reservation.agenda || '작성된 안건이 없습니다.'}</p>
            </div>
          </>
        )}
      </div>

      <div className="status-card-footer">
        {isEditing ? (
          <button
            className="linear-primary-button"
            style={{ width: 'auto', padding: '0 24px' }}
            onClick={handleSave}
          >
            저장
          </button>
        ) : (
          <>
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
              className="nav-menu-item"
              onClick={() => {
                onClose();
                navigate(`/minutes/${reservation.id}`);
              }}
            >
              회의록 보기
            </button>
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 24px' }}
              onClick={onClose}
            >
              닫기
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}

export default ReservationStatusDialog;
export type { ReservationStatus };
