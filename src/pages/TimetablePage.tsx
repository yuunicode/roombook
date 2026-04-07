import { useMemo, useState } from 'react';
import { addMonths, addWeeks } from 'date-fns';
import {
  AppIcon,
  MonthlyTimetable,
  ReservationDialog,
  ReservationStatusDialog,
  WeeklyTimetable,
  type ReservationDraft,
  type ReservationStatus,
  type TimetableReservation,
} from '../components';
import { useAppState } from '../stores';

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

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function TimetablePage() {
  const {
    userEmail,
    isLoggedIn,
    users,
    reservations,
    addReservation,
    updateReservation,
    deleteReservation,
  } = useAppState();
  
  const [calendarMode, setCalendarMode] = useState<'weekly' | 'monthly'>('weekly');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('room-a');
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [isReservationStatusOpen, setIsReservationStatusOpen] = useState(false);
  const [reservationStart, setReservationStart] = useState<Date>(
    roundToNearestHalfHour(new Date())
  );
  const [reservationEnd, setReservationEnd] = useState<Date>(
    new Date(roundToNearestHalfHour(new Date()).getTime() + 60 * 60 * 1000)
  );
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const displayName = isLoggedIn ? userEmail.split('@')[0] : '';
  
  const roomOptions = [
    { id: 'room-a', name: '회의실', capacity: '30명', icon: 'room' as const },
    { id: 'room-b', name: '회의테이블', capacity: '6명', icon: 'room' as const },
  ];

  const currentRoomId = roomOptions.some((room) => room.id === selectedRoom)
    ? selectedRoom
    : roomOptions[0]?.id ?? 'room-a';

  const visibleReservations = reservations.filter((item) => item.room === currentRoomId);

  const currentUser = useMemo(
    () => users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase()) ?? null,
    [users, userEmail]
  );

  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) {
      return null;
    }
    const found = reservations.find((item) => item.id === selectedReservationId);
    return found ?? null;
  }, [reservations, selectedReservationId]);

  const upcomingEvents = useMemo(() => {
    if (!isLoggedIn || !displayName) {
      return [];
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const normalizedName = displayName.toLowerCase();

    return reservations
      .filter((item) => {
        const reservationStart = new Date(item.start);
        const isInRange = reservationStart >= start && reservationStart < end;
        const includesMe = item.attendees.some((attendee) => {
          const attendeeName = attendee.name.trim().toLowerCase();
          const attendeeEmail = attendee.email.trim().toLowerCase();
          return attendeeName === normalizedName || attendeeEmail === userEmail.toLowerCase();
        });
        return isInRange && includesMe;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [displayName, isLoggedIn, reservations, userEmail]);

  const handleOpenReservationFromGrid = (start: Date, end: Date) => {
    setReservationStart(start);
    setReservationEnd(end);
    setIsReservationOpen(true);
  };

  const handleOpenReservationStatus = (reservation: TimetableReservation) => {
    setSelectedReservationId(reservation.id);
    setIsReservationStatusOpen(true);
  };

  const handleOpenReservationFromPlus = () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const end = new Date(today.getTime() + 60 * 60 * 1000);
    setReservationStart(today);
    setReservationEnd(end);
    setIsReservationOpen(true);
  };

  const handleConfirmReservation = (draft: ReservationDraft) => {
    const overlappingReservations = reservations.filter(
      (item) =>
        item.room === currentRoomId &&
        rangesOverlap(item.start, item.end, draft.start, draft.end)
    );

    if (overlappingReservations.length > 0) {
      window.alert('같은 회의실에는 같은 시간대에 중복 예약할 수 없습니다.');
      return;
    }

    addReservation(draft, currentRoomId);
  };

  const handleUpdateReservation = (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>
  ) => {
    updateReservation(reservationId, payload);
  };

  const handleDeleteReservation = (reservationId: string) => {
    deleteReservation(reservationId);
    setSelectedReservationId(null);
    setIsReservationStatusOpen(false);
  };

  const handleMovePrev = () => {
    setCalendarDate((prev) =>
      calendarMode === 'weekly' ? addWeeks(prev, -1) : addMonths(prev, -1),
    );
  };

  const handleMoveNext = () => {
    setCalendarDate((prev) =>
      calendarMode === 'weekly' ? addWeeks(prev, 1) : addMonths(prev, 1),
    );
  };

  const handleMoveToday = () => {
    setCalendarDate(new Date());
  };

  return (
    <div className="timetable-page-container">
      <section className="timetable-board">
        <section className="timetable-layout">
          <aside className="room-sidebar" aria-label="회의실 선택">
            <section className="sidebar-card sidebar-action-card" aria-label="예약 추가">
              <button
                className="sidebar-add-button"
                type="button"
                onClick={handleOpenReservationFromPlus}
              >
                <span className="sidebar-add-label">+ 예약 추가</span>
                <span className="sidebar-add-description">새 회의를 빠르게 등록합니다</span>
              </button>
            </section>

            <section className="sidebar-card" aria-label="회의실 유형">
              <div className="sidebar-card-heading">
                <AppIcon name="calendar" className="sidebar-card-icon" />
                <h3 className="sidebar-card-title">Spaces</h3>
              </div>
              {roomOptions.map((room) => (
                <button
                  key={room.id}
                  className={`room-button ${currentRoomId === room.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedRoom(room.id)}
                >
                  <div className="room-button-content">
                    <div className="room-button-main">
                      <AppIcon name={room.icon} className="room-button-icon" />
                      <span className="room-name-text">{room.name}</span>
                    </div>
                    <span className="room-capacity-tag">{room.capacity}</span>
                  </div>
                </button>
              ))}
            </section>

            <section className="sidebar-card upcoming-panel" aria-label="다가오는 회의">
              <div className="sidebar-card-heading">
                <AppIcon name="users" className="sidebar-card-icon" />
                <h3 className="sidebar-card-title">Up next</h3>
              </div>
              {!isLoggedIn ? (
                <p className="upcoming-empty">로그인하면 내 회의가 보여요.</p>
              ) : upcomingEvents.length === 0 ? (
                <p className="upcoming-empty">7일 내 예정된 회의가 없습니다.</p>
              ) : (
                <div className="upcoming-list">
                  {upcomingEvents.map((event) => (
                    <button 
                      key={event.id} 
                      className="upcoming-item"
                      type="button"
                      onClick={() => handleOpenReservationStatus(event)}
                    >
                      <p className="upcoming-item-title">{event.title}</p>
                      <p className="upcoming-item-meta">
                        {event.start.toLocaleDateString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          weekday: 'short',
                        })}{' '}
                        {event.start.toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="timetable-main">
            <section className="timetable-card timetable-main-card" aria-label="타임테이블">
              <div className="timetable-main-header">
                <div className="calendar-control-row">
                  <div className="page-view-toggle" role="tablist" aria-label="타임테이블 보기 전환">
                    <button
                      className={`page-view-button page-mode-button ${calendarMode === 'weekly' ? 'active' : ''}`}
                      type="button"
                      onClick={() => setCalendarMode('weekly')}
                    >
                      weekly
                    </button>
                    <button
                      className={`page-view-button page-mode-button ${calendarMode === 'monthly' ? 'active' : ''}`}
                      type="button"
                      onClick={() => setCalendarMode('monthly')}
                    >
                      monthly
                    </button>
                  </div>
                  <div className="page-view-toggle page-nav-only" aria-label="타임테이블 이동 컨트롤">
                    <button className="page-view-button page-nav-button" type="button" onClick={handleMoveToday}>
                      오늘
                    </button>
                    <button className="page-view-button page-nav-button" type="button" onClick={handleMovePrev}>
                      ‹
                    </button>
                    <button className="page-view-button page-nav-button" type="button" onClick={handleMoveNext}>
                      ›
                    </button>
                  </div>
                </div>
              </div>

              {calendarMode === 'weekly' ? (
                <WeeklyTimetable
                  reservations={visibleReservations}
                  currentDate={calendarDate}
                  onNavigate={setCalendarDate}
                  onSelectSlot={handleOpenReservationFromGrid}
                  onSelectReservation={handleOpenReservationStatus}
                />
              ) : (
                <MonthlyTimetable
                  reservations={visibleReservations}
                  currentDate={calendarDate}
                  onNavigate={setCalendarDate}
                  onSelectSlot={handleOpenReservationFromGrid}
                  onSelectReservation={handleOpenReservationStatus}
                />
              )}
            </section>
          </section>
        </section>
      </section>

      <ReservationDialog
        isOpen={isReservationOpen}
        initialStart={reservationStart}
        initialEnd={reservationEnd}
        currentUser={currentUser}
        users={users}
        onClose={() => setIsReservationOpen(false)}
        onConfirm={handleConfirmReservation}
      />
      <ReservationStatusDialog
        isOpen={isReservationStatusOpen}
        reservation={selectedReservation}
        currentUserEmail={userEmail}
        users={users}
        onClose={() => setIsReservationStatusOpen(false)}
        onSave={handleUpdateReservation}
        onDelete={handleDeleteReservation}
      />
    </div>
  );
}

export default TimetablePage;
