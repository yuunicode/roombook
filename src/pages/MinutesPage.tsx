import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '../stores';

function MinutesPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const { isLoggedIn, reservations, reservationLabels, updateReservation } = useAppState();

  const reservation = useMemo(
    () => (reservationId ? reservations.find((item) => item.id === reservationId) ?? null : null),
    [reservationId, reservations]
  );

  const [selectedLabel, setSelectedLabel] = useState('');
  const [title, setTitle] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [externalAttendees, setExternalAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [meetingContent, setMeetingContent] = useState('');
  const [meetingResult, setMeetingResult] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const agendaRef = useRef<HTMLTextAreaElement>(null);
  const meetingContentRef = useRef<HTMLTextAreaElement>(null);
  const meetingResultRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    if (!reservation) {
      return;
    }
    setSelectedLabel(reservation.label ?? reservationLabels[0] ?? '');
    setTitle(reservation.title ?? '');
    setDateInput(format(reservation.start, 'yyyy-MM-dd'));
    setStartTimeInput(format(reservation.start, 'HH:mm'));
    setEndTimeInput(format(reservation.end, 'HH:mm'));
    setExternalAttendees(reservation.externalAttendees ?? '');
    setAgenda(reservation.agenda ?? '');
    setMeetingContent(reservation.meetingContent ?? '');
    setMeetingResult(reservation.meetingResult ?? '');
    setSaveMessage('');
  }, [reservation, reservationLabels]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    resizeTextarea(agendaRef.current);
  }, [agenda]);

  useEffect(() => {
    resizeTextarea(meetingContentRef.current);
  }, [meetingContent]);

  useEffect(() => {
    resizeTextarea(meetingResultRef.current);
  }, [meetingResult]);

  const internalAttendeeText = reservation?.attendees.map((attendee) => attendee.name).join(', ') ?? '';

  const handleSave = () => {
    if (!reservation) {
      return;
    }
    if (!title.trim() || !dateInput || !startTimeInput || !endTimeInput) {
      setSaveMessage('필수 항목을 먼저 입력하세요.');
      return;
    }

    const nextStart = new Date(`${dateInput}T${startTimeInput}`);
    const nextEnd = new Date(`${dateInput}T${endTimeInput}`);

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      setSaveMessage('날짜 또는 시간 형식이 올바르지 않습니다.');
      return;
    }
    if (nextEnd <= nextStart) {
      setSaveMessage('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    updateReservation(reservation.id, {
      title: title.trim(),
      label: selectedLabel,
      start: nextStart,
      end: nextEnd,
      attendees: reservation.attendees,
      externalAttendees: externalAttendees.trim(),
      agenda: agenda.trim(),
      meetingContent: meetingContent.trim(),
      meetingResult: meetingResult.trim(),
      minutesAttachment: reservation.minutesAttachment,
    });
    setSaveMessage('저장되었습니다.');
  };

  if (!isLoggedIn) {
    return null;
  }

  if (!reservationId) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">회의록을 연결할 예약을 선택하세요</h2>
        <p className="page-subtitle">예약 카드의 [회의록 작성] 버튼으로 이동하면 자동 연동됩니다.</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">예약 정보를 찾을 수 없습니다</h2>
        <p className="page-subtitle">삭제되었거나 잘못된 접근입니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 0 40px' }}>
      <section style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
          <h1 className="page-title" style={{ fontSize: '24px', margin: 0 }}>회의록 작성</h1>
          <button className="nav-menu-item" type="button" onClick={() => navigate('/timetable')}>예약으로 돌아가기</button>
        </div>

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <label className="status-info-label">라벨</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {reservationLabels.map((label) => (
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

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <label className="status-info-label">회의 제목</label>
          <input className="linear-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <div className="status-info-group">
            <label className="status-info-label">날짜</label>
            <input className="linear-input" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">시작 시간</label>
            <input className="linear-input" type="time" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">종료 시간</label>
            <input className="linear-input" type="time" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} />
          </div>
        </div>

        <div className="status-info-group" style={{ marginBottom: '16px' }}>
          <label className="status-info-label">내부 참석자</label>
          <p className="status-info-value">{internalAttendeeText || '없음'}</p>
        </div>

        <div className="status-info-group" style={{ marginBottom: '8px' }}>
          <label className="status-info-label">외부 참석자</label>
          <input className="linear-input" value={externalAttendees} onChange={(e) => setExternalAttendees(e.target.value)} />
        </div>
      </section>

      <section style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
        <div className="status-info-group" style={{ marginBottom: '14px' }}>
          <label className="status-info-label">주요 안건</label>
          <textarea ref={agendaRef} className="minutes-textarea" style={{ minHeight: '120px', padding: '12px', fontSize: '14px', resize: 'none', overflow: 'hidden' }} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        </div>
        <div className="status-info-group" style={{ marginBottom: '14px' }}>
          <label className="status-info-label">회의 내용</label>
          <textarea ref={meetingContentRef} className="minutes-textarea" style={{ minHeight: '160px', padding: '12px', fontSize: '14px', resize: 'none', overflow: 'hidden' }} value={meetingContent} onChange={(e) => setMeetingContent(e.target.value)} />
        </div>
        <div className="status-info-group">
          <label className="status-info-label">회의 결과</label>
          <textarea ref={meetingResultRef} className="minutes-textarea" style={{ minHeight: '120px', padding: '12px', fontSize: '14px', resize: 'none', overflow: 'hidden' }} value={meetingResult} onChange={(e) => setMeetingResult(e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <p className="status-info-value" style={{ color: saveMessage === '저장되었습니다.' ? '#18794e' : '#d92d20' }}>{saveMessage}</p>
          <button className="linear-primary-button" type="button" style={{ width: 'auto', padding: '0 24px' }} onClick={handleSave}>
            저장하기
          </button>
        </div>
      </section>
    </div>
  );
}

export default MinutesPage;
