import {
  Calendar,
  Views,
  dateFnsLocalizer,
  type EventProps,
  type SlotInfo,
} from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  getReservationEventStyle,
  getReservationOwnerName,
  type TimetableReservation,
} from './WeeklyTimetable';

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
  const ownerName = getReservationOwnerName(event.creatorEmail ?? '');
  return <span>{`${startTime} ${ownerName} · ${event.title}`.trim()}</span>;
}

function MonthlyTimetable({
  reservations,
  currentDate,
  onNavigate,
  onSelectSlot,
  onSelectReservation,
}: any) {
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
        selectable
        style={{ height: 750 }}
        components={{
          event: MonthlyEventItem,
        }}
        eventPropGetter={(event) => getReservationEventStyle(event as TimetableReservation)}
        messages={{
          month: 'MONTHLY',
          today: '오늘',
          previous: '‹',
          next: '›',
          noEventsInRange: '예약이 없습니다.',
        }}
        onSelectSlot={(slotInfo: SlotInfo) => {
          const day = slotInfo.start.getDay();
          if (day === 0 || day === 6) return;
          onSelectSlot(slotInfo.start, slotInfo.end);
        }}
        onSelectEvent={(event) => onSelectReservation?.(event as TimetableReservation)}
      />
    </div>
  );
}

export default MonthlyTimetable;
