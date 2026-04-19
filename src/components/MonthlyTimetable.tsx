import { useState, type CSSProperties } from 'react';
import {
  addDays,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  max,
  min,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { getReservationEventStyle } from './weeklyTimetableUtils';
import type { TimetableReservation } from './WeeklyTimetable';

const VISIBLE_EVENT_COUNT = 3;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

type MonthlyTimetableProps = {
  reservations: TimetableReservation[];
  currentDate: Date;
  onNavigate: (nextDate: Date) => void;
  onSelectDate: (date: Date) => void;
  onSelectReservation?: (reservation: TimetableReservation) => void;
};

function getDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function getMonthWeeks(currentDate: Date) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const weeks: Date[][] = [];

  for (let cursor = calendarStart; cursor <= calendarEnd; cursor = addWeeks(cursor, 1)) {
    weeks.push(Array.from({ length: 5 }, (_, index) => addDays(cursor, index)));
  }

  return weeks;
}

function getGroupedReservations(reservations: TimetableReservation[]) {
  const grouped = new Map<string, TimetableReservation[]>();

  reservations.forEach((reservation) => {
    const key = getDateKey(reservation.start);
    const existing = grouped.get(key) ?? [];
    existing.push(reservation);
    grouped.set(key, existing);
  });

  grouped.forEach((items) => {
    items.sort((left, right) => left.start.getTime() - right.start.getTime());
  });

  return grouped;
}

function isWorkdayFullyBooked(date: Date, reservations: TimetableReservation[]) {
  const workdayStart = new Date(date);
  workdayStart.setHours(9, 0, 0, 0);
  const workdayEnd = new Date(date);
  workdayEnd.setHours(18, 0, 0, 0);

  const overlappingReservations = reservations
    .filter((reservation) => reservation.start < workdayEnd && reservation.end > workdayStart)
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (overlappingReservations.length === 0) {
    return false;
  }

  let coveredUntil = workdayStart;

  for (const reservation of overlappingReservations) {
    const clippedStart = max([reservation.start, workdayStart]);
    const clippedEnd = min([reservation.end, workdayEnd]);

    if (clippedStart.getTime() > coveredUntil.getTime()) {
      return false;
    }

    if (clippedEnd.getTime() > coveredUntil.getTime()) {
      coveredUntil = clippedEnd;
    }

    if (coveredUntil.getTime() >= workdayEnd.getTime()) {
      return true;
    }
  }

  return coveredUntil.getTime() >= workdayEnd.getTime();
}

function getMonthlyEventTitle(event: TimetableReservation) {
  const startTime = event.start ? format(event.start, 'HH:mm') : '';
  const normalizedLabel = (event.label ?? '').trim();
  const labelAndTitle =
    normalizedLabel && normalizedLabel !== '없음'
      ? `[${normalizedLabel}] ${event.title}`
      : event.title;

  return `${startTime} ${labelAndTitle}`.trim();
}

function MonthlyTimetable({
  reservations,
  currentDate,
  onSelectDate,
  onSelectReservation,
}: MonthlyTimetableProps) {
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const monthWeeks = getMonthWeeks(currentDate);
  const reservationsByDate = getGroupedReservations(reservations);

  const handleDayClick = (date: Date, isFullyBooked: boolean) => {
    if (isFullyBooked) return;
    onSelectDate(startOfDay(date));
  };

  return (
    <div className="monthly-calendar" aria-label="월간 타임테이블">
      <div className="monthly-calendar-header">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="monthly-calendar-header-cell">
            {label}
          </div>
        ))}
      </div>

      <div className="monthly-calendar-grid">
        {monthWeeks.map((week, weekIndex) => (
          <div key={`${getDateKey(week[0])}-${weekIndex}`} className="monthly-calendar-week">
            {week.map((date) => {
              const dateKey = getDateKey(date);
              const dayReservations = reservationsByDate.get(dateKey) ?? [];
              const visibleReservations = dayReservations.slice(0, VISIBLE_EVENT_COUNT);
              const hiddenReservations = dayReservations.slice(VISIBLE_EVENT_COUNT);
              const isExpanded = expandedDateKey === dateKey;
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isFullyBooked = isWorkdayFullyBooked(date, dayReservations);

              return (
                <div
                  key={dateKey}
                  className={`monthly-calendar-cell${isCurrentMonth ? '' : ' is-outside-month'}${
                    isToday(date) ? ' is-today' : ''
                  }${isFullyBooked ? ' is-fully-booked' : ''}`}
                  role={isFullyBooked ? undefined : 'button'}
                  tabIndex={isFullyBooked ? -1 : 0}
                  onClick={() => handleDayClick(date, isFullyBooked)}
                  onKeyDown={(keyboardEvent) => {
                    if (isFullyBooked) return;
                    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                      keyboardEvent.preventDefault();
                      handleDayClick(date, false);
                    }
                  }}
                >
                  <span className="monthly-calendar-date-label">
                    {format(date, 'M/d (EEE)', { locale: ko })}
                  </span>

                  <div className="monthly-calendar-events">
                    {visibleReservations.map((reservation) => {
                      const eventStyle =
                        getReservationEventStyle(reservation).style ?? ({} as CSSProperties);

                      return (
                        <button
                          key={reservation.id}
                          type="button"
                          className="monthly-calendar-event"
                          style={eventStyle}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onSelectReservation?.(reservation);
                          }}
                        >
                          <span className="monthly-event-title">
                            {getMonthlyEventTitle(reservation)}
                          </span>
                        </button>
                      );
                    })}

                    {hiddenReservations.length > 0 ? (
                      <div className="monthly-calendar-overflow">
                        <button
                          type="button"
                          className="monthly-calendar-more-button"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setExpandedDateKey((previous) =>
                              previous === dateKey ? null : dateKey
                            );
                          }}
                        >
                          +{hiddenReservations.length}
                        </button>

                        {isExpanded ? (
                          <div
                            className="monthly-calendar-overflow-panel"
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                          >
                            {hiddenReservations.map((reservation) => {
                              const eventStyle =
                                getReservationEventStyle(reservation).style ??
                                ({} as CSSProperties);

                              return (
                                <button
                                  key={reservation.id}
                                  type="button"
                                  className="monthly-calendar-event"
                                  style={eventStyle}
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation();
                                    onSelectReservation?.(reservation);
                                  }}
                                >
                                  <span className="monthly-event-title">
                                    {getMonthlyEventTitle(reservation)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MonthlyTimetable;
