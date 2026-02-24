import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LoginDialog,
  ReservationDialog,
  WeeklyTimetable,
  type ReservationDraft,
  type TimetableReservation,
} from '../components';

function roundToNearestHalfHour(date: Date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  if (minutes < 30) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  }
  return rounded;
}

function HomePage() {
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [reservationStart, setReservationStart] = useState<Date>(
    roundToNearestHalfHour(new Date())
  );
  const [reservations, setReservations] = useState<TimetableReservation[]>([
    {
      id: 'seed-1',
      title: '제품 기획 미팅',
      start: new Date(2026, 1, 23, 10, 0),
      end: new Date(2026, 1, 23, 10, 30),
      attendees: '기획팀',
      reference: '',
    },
  ]);

  const isLoggedIn = userEmail.length > 0;

  const handleLogin = (email: string) => {
    setUserEmail(email);
  };

  const handleOpenReservationFromGrid = (start: Date) => {
    setReservationStart(start);
    setIsReservationOpen(true);
  };

  const handleOpenReservationFromPlus = () => {
    const today = roundToNearestHalfHour(new Date());
    setReservationStart(today);
    setIsReservationOpen(true);
  };

  const handleConfirmReservation = (draft: ReservationDraft) => {
    setReservations((previous) => [
      ...previous,
      {
        id: String(Date.now()),
        title: draft.title,
        attendees: draft.attendees,
        reference: draft.reference,
        start: draft.start,
        end: draft.end,
      },
    ]);
  };

  return (
    <>
      <main className="home-page">
        <header className="top-bar">
          <div>
            <h1 className="app-title">회의실 예약 시스템</h1>
            <p className="app-subtitle">원하는 시간대를 선택해 빠르게 회의를 예약하세요.</p>
          </div>
          <div className="top-bar-actions">
            {isLoggedIn ? (
              <>
                <span className="account-badge">{userEmail}</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => navigate('/my-meetings')}
                >
                  나의 회의목록
                </button>
              </>
            ) : (
              <button className="primary-button" type="button" onClick={() => setIsLoginOpen(true)}>
                로그인
              </button>
            )}
          </div>
        </header>

        <WeeklyTimetable reservations={reservations} onSelectSlot={handleOpenReservationFromGrid} />
      </main>

      <LoginDialog
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
      />
      <ReservationDialog
        isOpen={isReservationOpen}
        initialStart={reservationStart}
        onClose={() => setIsReservationOpen(false)}
        onConfirm={handleConfirmReservation}
      />
      {!isReservationOpen ? (
        <button
          className="fab-add"
          type="button"
          aria-label="예약 추가"
          onClick={handleOpenReservationFromPlus}
        >
          +
        </button>
      ) : null}
    </>
  );
}

export default HomePage;
