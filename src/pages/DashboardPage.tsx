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
        <section className="dashboard-card" onClick={() => navigate('/timetable')}>
          <div className="card-icon-box">
            <AppIcon name="calendar" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의실 예약하기</h2>
            <p className="card-desc">팀원들과 협업할 수 있는 최적의 공간을 예약하세요.</p>
          </div>
        </section>

        <section className="dashboard-card" onClick={() => navigate('/minutes')}>
          <div className="card-icon-box">
            <AppIcon name="room" className="card-main-icon" />
          </div>
          <div className="card-info">
            <h2 className="card-title">회의록 작성</h2>
            <p className="card-desc">중요한 논의 사항과 결정을 놓치지 않도록 기록하세요.</p>
          </div>
        </section>
      </div>

      <section style={{ marginTop: '48px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingLeft: '4px' }}>내 다가오는 일정</h3>
        <div className="dashboard-mini-list">
          {myUpcomingMeetings.length > 0 ? (
            myUpcomingMeetings.map(meeting => (
              <div key={meeting.id} className="mini-item">
                <div className="mini-time" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', width: '60px' }}>
                  {meeting.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
                <div className="mini-content">
                  <p className="mini-title" style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{meeting.title}</p>
                  <p className="mini-meta" style={{ fontSize: '12px', color: 'var(--text-soft)' }}>{meeting.room} · {meeting.attendees.length}명 참석</p>
                </div>
              </div>
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
