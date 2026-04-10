import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon } from '../components';
import { useAppState } from '../stores';

function MyMeetingsPage() {
  const navigate = useNavigate();
  const { userEmail, isLoggedIn, reservations } = useAppState();

  const filteredMeetings = useMemo(
    () =>
      reservations
        .filter((reservation) => {
          const isCreator =
            reservation.creatorEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
          const isAttendee = reservation.attendees.some(
            (attendee) => attendee.email.trim().toLowerCase() === userEmail.trim().toLowerCase()
          );
          return isCreator || isAttendee;
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [reservations, userEmail]
  );

  return (
    <main className="my-meetings-page">
      <header className="my-meetings-header">
        <div className="page-title-block">
          <span className="page-title-icon-shell">
            <AppIcon name="calendar" className="page-title-icon" />
          </span>
          <div className="page-title-copy">
            <h1 className="section-title">마이페이지</h1>
            <p className="meeting-meta">내가 만든 회의이거나 참석자로 포함된 회의만 표시합니다.</p>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate('/')}>
          <AppIcon name="arrow-left" className="button-icon" />
          메인으로
        </button>
      </header>

      {!isLoggedIn ? (
        <section className="meeting-list-card">
          <article className="meeting-item">
            <h2 className="meeting-topic">로그인이 필요합니다</h2>
            <p className="meeting-meta">user@ecminer.com으로 로그인한 뒤 다시 확인하세요.</p>
          </article>
        </section>
      ) : filteredMeetings.length === 0 ? (
        <section className="meeting-list-card">
          <article className="meeting-item">
            <h2 className="meeting-topic">표시할 회의가 없습니다</h2>
            <p className="meeting-meta">현재 사용자와 연결된 예약이 아직 없습니다.</p>
          </article>
        </section>
      ) : (
        <section className="meeting-list-card">
          {filteredMeetings.map((meeting) => (
            <article key={meeting.id} className="meeting-item">
              <h2 className="meeting-topic">{meeting.title}</h2>
              <p className="meeting-meta">
                {meeting.start.toLocaleDateString('ko-KR')} /{' '}
                {meeting.start.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}{' '}
                -{' '}
                {meeting.end.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </p>
              <p className="meeting-meta">회의실: {meeting.roomName}</p>
              <p className="meeting-meta">예약자: {meeting.creatorName || meeting.creatorEmail}</p>
              <p className="meeting-meta">
                참석자: {meeting.attendees.map((attendee) => attendee.name).join(', ') || '없음'}
              </p>
              <p className="meeting-meta">안건: {meeting.agenda || '없음'}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default MyMeetingsPage;
