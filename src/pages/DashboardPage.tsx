import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';
import { AppIcon } from '../components';

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoggedIn, userEmail, users, reservations } = useAppState();
  const displayName = isLoggedIn
    ? (users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase())?.name ??
      userEmail.split('@')[0])
    : '';

  const now = new Date();
  const myUpcomingMeetings = reservations
    .filter((r) => {
      const isParticipant = r.attendees.some(
        (a) => a.email.toLowerCase() === userEmail.toLowerCase()
      );
      const isUpcomingOrOngoing = r.end.getTime() >= now.getTime();
      return isParticipant && isUpcomingOrOngoing;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 3);

  return (
    <div className="dashboard-page">
      <header className="page-header-content">
        <h1 className="page-title">안녕하세요, {isLoggedIn ? displayName : '방문자'}님</h1>
        <p className="page-subtitle">오늘의 업무와 회의 일정을 확인하세요.</p>
      </header>

      <div className="dashboard-grid">
        <section className="dashboard-card" onClick={() => navigate('/timetable')}>
          <div className="card-icon-box">
            <AppIcon name="calendar" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의실 예약하기</h2>
            <p className="card-desc">팀원들과 협업할 수 있는 최적의 공간을 예약하세요.</p>
          </div>
        </section>

        <section className="dashboard-card" onClick={() => navigate('/minutes-wiki')}>
          <div className="card-icon-box">
            <AppIcon name="room" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의록 Wiki</h2>
            <p className="card-desc">회의록을 통합 조회하고 원하는 문서를 바로 확인하세요.</p>
          </div>
        </section>
      </div>

      <section style={{ marginTop: '48px' }}>
        <h3
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            paddingLeft: '4px',
          }}
        >
          내 다가오는 일정
        </h3>
        <div className="dashboard-upcoming-row">
          {myUpcomingMeetings.length > 0 ? (
            myUpcomingMeetings.map((meeting) => (
              <button
                key={meeting.id}
                className="upcoming-item-card dashboard-upcoming-card"
                onClick={() => navigate('/timetable')}
              >
                <p className="upcoming-item-label">{meeting.label || '-'}</p>
                <p className="upcoming-item-time">
                  {meeting.start.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                  })}
                  ,{' '}
                  {meeting.start.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  {' · '}
                  {meeting.roomName}
                </p>
                <p className="upcoming-item-title">{meeting.title}</p>
                <p className="upcoming-item-attendees">
                  {meeting.attendees.map((attendee) => attendee.name).join(', ') || '참석자 없음'}
                </p>
              </button>
            ))
          ) : (
            <p className="upcoming-empty">예정된 회의가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
