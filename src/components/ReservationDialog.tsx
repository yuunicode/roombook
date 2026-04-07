import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAgenda('');
      setAttendeeQuery('');
      setSelectedAttendees(currentUser ? [currentUser] : []);
    }
  }, [isOpen, currentUser]);

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) return [];
    return users.filter(u => !selectedAttendees.some(a => a.id === u.id) && (u.name.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword)));
  }, [attendeeQuery, selectedAttendees, users]);

  const handleConfirm = () => {
    if (!title.trim()) return;
    onConfirm({
      title: title.trim(),
      start: initialStart,
      end: initialEnd,
      attendees: selectedAttendees,
      agenda: agenda.trim(),
      minutesAttachment: '',
    });
  };

  const timeRangeString = `${initialStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${initialEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} contentClassName="reservation-dialog-card" showCloseButton>
      <div className="status-card-header">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <span className="status-badge">{initialStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
          <span className="status-badge" style={{ background: 'rgba(94, 106, 210, 0.06)', color: 'var(--accent)' }}>{timeRangeString}</span>
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>새 회의 예약</h2>
      </div>

      <div className="status-card-body">
        <div className="status-info-group">
          <label className="status-info-label">회의 제목</label>
          <input className="linear-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="회의 제목을 입력하세요" autoFocus />
        </div>

        <div className="status-info-group">
          <label className="status-info-label">참석자 초대</label>
          <input className="linear-input" style={{ marginBottom: '8px' }} value={attendeeQuery} placeholder="이름 또는 이메일 검색..." onChange={(e) => setAttendeeQuery(e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectedAttendees.map(a => <span key={a.id} className="room-capacity-tag" style={{ cursor: 'pointer' }} onClick={() => setSelectedAttendees(prev => prev.filter(item => item.id !== a.id))}>{a.name} ✕</span>)}
          </div>
          {filteredUsers.length > 0 && (
            <div className="user-dropdown-popover" style={{ position: 'static', width: '100%', marginTop: '8px', boxShadow: 'none', border: '1px solid var(--border)' }}>
              {filteredUsers.slice(0, 4).map(u => <button key={u.id} className="popover-item" onClick={() => { setSelectedAttendees(prev => [...prev, u]); setAttendeeQuery(''); }}>{u.name} ({u.email})</button>)}
            </div>
          )}
        </div>

        <div className="status-info-group">
          <label className="status-info-label">회의 안건</label>
          <textarea className="minutes-textarea" style={{ minHeight: '120px', padding: '12px', fontSize: '14px' }} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="안건을 입력하세요" />
        </div>
      </div>

      <div className="status-card-footer">
        <button className="nav-menu-item" onClick={onClose}>취소</button>
        <button className="linear-primary-button" style={{ width: 'auto', padding: '0 24px', marginTop: 0 }} onClick={handleConfirm} disabled={!title.trim()}>예약 완료</button>
      </div>
    </Dialog>
  );
}

export default ReservationDialog;
export type { ReservationDraft };
