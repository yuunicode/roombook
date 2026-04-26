import { useEffect, useMemo, useState } from 'react';
import { addMonths, addWeeks } from 'date-fns';
import {
  AppIcon,
  MonthlyTimetable,
  ReservationDialog,
  ReservationStatusDialog,
  WeeklyTimetable,
  type ReservationDraft,
  type TimetableReservation,
} from '../components';
import { openReservationEvents } from '../api';
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
    rooms,
    reservations,
    reservationLabels,
    addReservation,
    reloadReservations,
    updateReservation,
    deleteReservation,
  } = useAppState();

  const [calendarMode, setCalendarMode] = useState<'weekly' | 'monthly'>('weekly');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('A');
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [isReservationStatusOpen, setIsReservationStatusOpen] = useState(false);
  const [reservationStart, setReservationStart] = useState<Date>(
    roundToNearestHalfHour(new Date())
  );
  const [reservationEnd, setReservationEnd] = useState<Date>(
    new Date(roundToNearestHalfHour(new Date()).getTime() + 60 * 60 * 1000)
  );
  const [startWithEmptyTimeSelection, setStartWithEmptyTimeSelection] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const roomOptions = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: `${room.capacity}명`,
    icon: 'room' as const,
  }));

  const currentRoomId = roomOptions.some((room) => room.id === selectedRoom)
    ? selectedRoom
    : roomOptions[0]?.id;
  const visibleReservations = reservations.filter((item) => item.roomId === currentRoomId);
  const currentUser = useMemo(
    () => users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase()) ?? null,
    [users, userEmail]
  );
  const selectedReservation = useMemo(
    () =>
      selectedReservationId
        ? (reservations.find((item) => item.id === selectedReservationId) ?? null)
        : null,
    [reservations, selectedReservationId]
  );

  const upcomingEvents = useMemo(() => {
    if (!isLoggedIn) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return reservations
      .filter((item) => {
        const itemStart = new Date(item.start);
        return (
          itemStart >= start &&
          itemStart < end &&
          item.attendees.some((a) => a.email.toLowerCase() === userEmail.toLowerCase())
        );
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [isLoggedIn, reservations, userEmail]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let isActive = true;
    let isReloading = false;
    let needsReload = false;

    const syncReservations = async () => {
      if (!isActive) return;
      if (isReloading) {
        needsReload = true;
        return;
      }

      isReloading = true;
      try {
        await reloadReservations();
      } finally {
        isReloading = false;
        if (needsReload) {
          needsReload = false;
          void syncReservations();
        }
      }
    };

    void syncReservations();

    const eventSource = openReservationEvents();
    const handleReservationEvent = () => {
      void syncReservations();
    };
    const handleFocus = () => {
      void syncReservations();
    };

    eventSource.addEventListener('reservation', handleReservationEvent);
    window.addEventListener('focus', handleFocus);

    return () => {
      isActive = false;
      eventSource.removeEventListener('reservation', handleReservationEvent);
      eventSource.close();
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedIn, reloadReservations]);

  const handleOpenReservationFromGrid = (start: Date, end: Date) => {
    if (!currentRoomId) return;
    const hasConflict = reservations.some(
      (item) =>
        item.roomId === currentRoomId &&
        item.id !== selectedReservationId &&
        rangesOverlap(item.start, item.end, start, end)
    );
    if (hasConflict) {
      alert('이미 예약된 시간대입니다.');
      return;
    }
    setReservationStart(start);
    setReservationEnd(end);
    setStartWithEmptyTimeSelection(false);
    setIsReservationOpen(true);
  };

  const handleOpenReservationFromMonth = (date: Date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    setReservationStart(selectedDate);
    setReservationEnd(selectedDate);
    setStartWithEmptyTimeSelection(true);
    setIsReservationOpen(true);
  };

  const handleOpenReservationStatus = (reservation: TimetableReservation) => {
    setSelectedReservationId(reservation.id);
    setIsReservationStatusOpen(true);
  };

  const handleOpenReservationFromPlus = () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    setReservationStart(today);
    setReservationEnd(new Date(today.getTime() + 60 * 60 * 1000));
    setStartWithEmptyTimeSelection(false);
    setIsReservationOpen(true);
  };

  const isSlotBlocked = (start: Date, end: Date) => {
    if (!currentRoomId) return false;
    return reservations.some(
      (item) => item.roomId === currentRoomId && rangesOverlap(item.start, item.end, start, end)
    );
  };

  const handleConfirmReservation = async (draft: ReservationDraft) => {
    if (!currentRoomId) return;
    if (
      reservations.some(
        (r) => r.roomId === currentRoomId && rangesOverlap(r.start, r.end, draft.start, draft.end)
      )
    ) {
      alert('중복된 예약이 있습니다.');
      return;
    }
    try {
      await addReservation(draft, currentRoomId);
      setIsReservationOpen(false);
    } catch (error) {
      try {
        await reloadReservations();
      } catch {
        // ignore refresh failure and keep showing original reservation failure message
      }
      const message = error instanceof Error ? error.message : '예약 생성에 실패했습니다.';
      if (message.includes('이미 해당 시간대에 예약이 존재합니다') || message.includes('중복')) {
        alert(
          '다른 사용자가 먼저 예약했습니다. 최신 예약 현황을 반영했습니다. 시간을 다시 선택해 주세요.'
        );
        return;
      }
      alert(message);
    }
  };

  return (
    <div className="timetable-page-container">
      <section className="timetable-layout">
        <aside className="room-sidebar">
          <button className="sidebar-add-button" onClick={handleOpenReservationFromPlus}>
            <span className="sidebar-add-label">+ 예약 추가</span>
            <span className="sidebar-add-description">새 회의를 빠르게 등록합니다</span>
          </button>

          <section className="sidebar-card">
            <div className="sidebar-card-heading">
              <AppIcon name="calendar" className="sidebar-card-icon" />
              <h3 className="sidebar-card-title">Spaces</h3>
            </div>
            {roomOptions.map((room) => (
              <button
                key={room.id}
                className={`room-button ${currentRoomId === room.id ? 'active' : ''}`}
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

          <section className="sidebar-card">
            <div className="sidebar-card-heading">
              <AppIcon name="users" className="sidebar-card-icon" />
              <h3 className="sidebar-card-title">Up next</h3>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="upcoming-list">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    className="upcoming-item-card"
                    onClick={() => handleOpenReservationStatus(event)}
                  >
                    <p className="upcoming-item-label">{event.label || '-'}</p>
                    <p className="upcoming-item-time">
                      {event.start.toLocaleDateString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        weekday: 'short',
                      })}
                      ,{' '}
                      {event.start.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                      {' · '}
                      {event.roomName}
                    </p>
                    <p className="upcoming-item-title">{event.title}</p>
                    <p className="upcoming-item-attendees">
                      {event.attendees.map((attendee) => attendee.name).join(', ') || '참석자 없음'}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="upcoming-empty">예정된 회의가 없습니다.</p>
            )}
          </section>
        </aside>

        <section className="timetable-main">
          <div className="calendar-control-row">
            <div className="page-view-controls">
              <div className="page-view-toggle">
                <button
                  className={`page-mode-button ${calendarMode === 'weekly' ? 'active' : ''}`}
                  onClick={() => setCalendarMode('weekly')}
                >
                  Weekly
                </button>
                <button
                  className={`page-mode-button ${calendarMode === 'monthly' ? 'active' : ''}`}
                  onClick={() => setCalendarMode('monthly')}
                >
                  Monthly
                </button>
              </div>
              <p className="page-view-helper">사용시간을 드래그하여 예약할 수 있습니다.</p>
            </div>
            <div className="page-nav-only">
              <button className="page-nav-button" onClick={() => setCalendarDate(new Date())}>
                오늘
              </button>
              <button
                className="page-nav-button"
                onClick={() =>
                  setCalendarDate((prev) =>
                    calendarMode === 'weekly' ? addWeeks(prev, -1) : addMonths(prev, -1)
                  )
                }
              >
                ‹
              </button>
              <button
                className="page-nav-button"
                onClick={() =>
                  setCalendarDate((prev) =>
                    calendarMode === 'weekly' ? addWeeks(prev, 1) : addMonths(prev, 1)
                  )
                }
              >
                ›
              </button>
            </div>
          </div>

          {calendarMode === 'weekly' ? (
            <WeeklyTimetable
              reservations={visibleReservations}
              currentDate={calendarDate}
              onNavigate={setCalendarDate}
              onSelectSlot={handleOpenReservationFromGrid}
              onSelectReservation={handleOpenReservationStatus}
              isSlotBlocked={isSlotBlocked}
            />
          ) : (
            <MonthlyTimetable
              reservations={visibleReservations}
              currentDate={calendarDate}
              onNavigate={setCalendarDate}
              onSelectDate={handleOpenReservationFromMonth}
              onSelectReservation={handleOpenReservationStatus}
            />
          )}
        </section>
      </section>

      <ReservationDialog
        isOpen={isReservationOpen}
        initialStart={reservationStart}
        initialEnd={reservationEnd}
        startWithEmptyTimeSelection={startWithEmptyTimeSelection}
        currentUser={currentUser}
        users={users}
        labelOptions={reservationLabels}
        occupiedRanges={visibleReservations.map((item) => ({ start: item.start, end: item.end }))}
        onClose={() => setIsReservationOpen(false)}
        onConfirm={handleConfirmReservation}
      />
      <ReservationStatusDialog
        isOpen={isReservationStatusOpen}
        reservation={selectedReservation}
        currentUser={currentUser}
        users={users}
        rooms={rooms}
        labelOptions={reservationLabels}
        occupiedRanges={reservations.map((item) => ({
          id: item.id,
          roomId: item.roomId,
          start: item.start,
          end: item.end,
        }))}
        onClose={() => setIsReservationStatusOpen(false)}
        onSave={updateReservation}
        onDelete={deleteReservation}
      />
    </div>
  );
}

export default TimetablePage;
