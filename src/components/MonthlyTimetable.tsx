import { Calendar, Views, dateFnsLocalizer, type EventProps } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getReservationEventStyle } from './weeklyTimetableUtils';
import type { TimetableReservation } from './WeeklyTimetable';

const locales = {
  ko,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

function MonthlyEventItem({ event }: EventProps<TimetableReservation>) {
  const startTime = event.start ? format(event.start, 'HH:mm') : '';
  const normalizedLabel = (event.label ?? '').trim();
  const labelAndTitle =
    normalizedLabel && normalizedLabel !== '없음'
      ? `[${normalizedLabel}] ${event.title}`
      : event.title;
  const titleLine = `${startTime} ${labelAndTitle}`.trim();
  return <span className="monthly-event-title">{titleLine}</span>;
}

type MonthlyTimetableProps = {
  reservations: TimetableReservation[];
  currentDate: Date;
  onNavigate: (nextDate: Date) => void;
  onSelectDate: (date: Date) => void;
  onSelectReservation?: (reservation: TimetableReservation) => void;
};

function MonthlyTimetable({
  reservations,
  currentDate,
  onNavigate,
  onSelectDate,
  onSelectReservation,
}: MonthlyTimetableProps) {
  const handleDayClick = (date: Date) => {
    onSelectDate(date);
  };

  const DateHeaderButton = ({ date, label }: { date: Date; label: string }) => {
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) return null;

    return (
      <button
        type="button"
        onClick={() => handleDayClick(date)}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="rbc-wrapper" aria-label="월간 타임테이블">
      <Calendar
        className="monthly-calendar"
        localizer={localizer}
        events={reservations}
        date={currentDate}
        onNavigate={onNavigate}
        startAccessor="start"
        endAccessor="end"
        defaultView={Views.MONTH}
        views={[Views.MONTH]}
        toolbar={false}
        selectable={false} // 래퍼에서 직접 처리하므로 기본 선택 기능 비활성화
        style={{ height: 750 }}
        components={{
          event: MonthlyEventItem,
          month: {
            dateHeader: DateHeaderButton,
          },
        }}
        eventPropGetter={(event) => getReservationEventStyle(event as TimetableReservation)}
        messages={{
          month: 'MONTHLY',
          today: '오늘',
          previous: '‹',
          next: '›',
          noEventsInRange: '예약이 없습니다.',
        }}
        onSelectEvent={(event) => onSelectReservation?.(event as TimetableReservation)}
      />
    </div>
  );
}

export default MonthlyTimetable;
