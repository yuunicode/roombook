import { useNavigate } from 'react-router-dom';

const myMeetings = [
  { id: '1', room: 'A 회의실', date: '2026-02-24', time: '10:00 - 11:00', topic: '주간 기획 회의' },
  { id: '2', room: 'B 회의실', date: '2026-02-25', time: '14:00 - 15:00', topic: '디자인 리뷰' },
];

function MyMeetingsPage() {
  const navigate = useNavigate();

  return (
    <main className="my-meetings-page">
      <header className="my-meetings-header">
        <h1 className="section-title">나의 회의목록</h1>
        <button className="secondary-button" type="button" onClick={() => navigate('/')}>
          메인으로
        </button>
      </header>

      <section className="meeting-list-card">
        {myMeetings.map((meeting) => (
          <article key={meeting.id} className="meeting-item">
            <h2 className="meeting-topic">{meeting.topic}</h2>
            <p className="meeting-meta">
              {meeting.date} / {meeting.time}
            </p>
            <p className="meeting-meta">{meeting.room}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default MyMeetingsPage;
