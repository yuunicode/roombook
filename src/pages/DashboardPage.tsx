import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';
import { AppIcon } from '../components';

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoggedIn, userEmail, reservations } = useAppState();
  const displayName = isLoggedIn ? userEmail.split('@')[0] : '';

  const myUpcomingMeetings = reservations
    .filter(r => r.attendees.some(a => a.email.toLowerCase() === userEmail.toLowerCase()))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 3);

  return (
    <div className="dashboard-page">
      <header className="page-header-content">
        <h1 className="page-title">안녕하세요, {isLoggedIn ? displayName : '방문자'}님</h1>
        <p className="page-subtitle">오늘의 업무와 회의 일정을 확인하세요.</p>
      </header>

      <div className="dashboard-grid">
        <section className="dashboard-card main-action-card" onClick={() => navigate('/timetable')}>
          <div className="card-icon-box">
            <AppIcon name="calendar" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의실 예약하기</h2>
            <p className="card-desc">팀원들과 협업할 수 있는 최적의 공간을 예약하세요.</p>
          </div>
          <AppIcon name="chevron-right" className="card-arrow" />
        </section>

        <section className="dashboard-card main-action-card" onClick={() => navigate('/minutes')}>
          <div className="card-icon-box">
            <AppIcon name="room" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의록 작성</h2>
            <p className="card-desc">중요한 논의 사항과 결정을 놓치지 않도록 기록하세요.</p>
          </div>
          <AppIcon name="chevron-right" className="card-arrow" />
        </section>

        <section className="dashboard-list-section">
          <h3 className="section-small-title">다가오는 내 회의</h3>
          <div className="dashboard-mini-list">
            {myUpcomingMeetings.length > 0 ? (
              myUpcomingMeetings.map(meeting => (
                <div key={meeting.id} className="mini-item">
                  <div className="mini-time">
                    {meeting.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                  <div className="mini-content">
                    <p className="mini-title">{meeting.title}</p>
                    <p className="mini-meta">{meeting.room} · {meeting.attendees.length}명 참석</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-text">예정된 회의가 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
