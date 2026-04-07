import {
  Calendar,
  Views,
  dateFnsLocalizer,
  type EventProps,
  type Event as CalendarEvent,
  type SlotInfo,
} from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { AppUser } from '../stores';

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

const eventPalette = [
  { backgroundColor: 'rgba(17, 24, 39, 0.08)', borderColor: 'rgba(17, 24, 39, 0.14)' },
  { backgroundColor: 'rgba(31, 41, 55, 0.09)', borderColor: 'rgba(31, 41, 55, 0.14)' },
  { backgroundColor: 'rgba(55, 65, 81, 0.09)', borderColor: 'rgba(55, 65, 81, 0.14)' },
  { backgroundColor: 'rgba(75, 85, 99, 0.08)', borderColor: 'rgba(75, 85, 99, 0.14)' },
  { backgroundColor: 'rgba(107, 114, 128, 0.08)', borderColor: 'rgba(107, 114, 128, 0.14)' },
];

function hashReservationId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getReservationEventStyle(event: TimetableReservation) {
  const palette = eventPalette[hashReservationId(event.id) % eventPalette.length];
  return {
    style: {
      backgroundColor: palette.backgroundColor,
      border: `1px solid ${palette.borderColor}`,
      color: '#111827',
      borderRadius: '4px',
      boxShadow: 'none',
    },
  };
}

function getReservationOwnerName(creatorEmail: string) {
  const normalizedEmail = creatorEmail.trim();
  if (!normalizedEmail) {
    return '예약자 미정';
  }
  return normalizedEmail.split('@')[0] ?? normalizedEmail;
}

export type TimetableReservation = CalendarEvent & {
  id: string;
  title: string;
  start: Date;
  end: Date;
  attendees: AppUser[];
  agenda: string;
  minutesAttachment: string;
  creatorEmail: string;
};

type WeeklyTimetableProps = {
  reservations: TimetableReservation[];
  currentDate: Date;
  onNavigate: (nextDate: Date) => void;
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectReservation?: (reservation: TimetableReservation) => void;
};

function WeeklyEventCard({ event }: EventProps<TimetableReservation>) {
  const attendeeNames = (event.attendees ?? []).map((attendee) => attendee.name);
  const ownerName = getReservationOwnerName(event.creatorEmail ?? '');
  const isCompactEvent =
    event.start instanceof Date &&
    event.end instanceof Date &&
    event.end.getTime() - event.start.getTime() <= 30 * 60 * 1000;

  return (
    <div className="weekly-event-card">
      {isCompactEvent ? (
        <p className="weekly-event-title">{ownerName}</p>
      ) : (
        <>
          <p className="weekly-event-owner">{ownerName}</p>
          <p className="weekly-event-title">{event.title}</p>
          <p className="weekly-event-attendees">{attendeeNames.join(', ') || '참여자 없음'}</p>
        </>
      )}
    </div>
  );
}

function WeeklyTimetable({
  reservations,
  currentDate,
  onNavigate,
  onSelectSlot,
  onSelectReservation,
}: WeeklyTimetableProps) {
  return (
    <div className="rbc-wrapper" aria-label="주간 타임테이블">
      <Calendar
        className="weekly-calendar"
        localizer={localizer}
        events={reservations}
        date={currentDate}
        onNavigate={onNavigate}
        startAccessor="start"
        endAccessor="end"
        defaultView={Views.WORK_WEEK}
        views={[Views.WORK_WEEK]}
        toolbar={false}
        dayLayoutAlgorithm="no-overlap"
        selectable
        step={30}
        timeslots={2}
        min={new Date(1970, 1, 1, 9, 0, 0)}
        max={new Date(1970, 1, 1, 18, 0, 0)}
        style={{ height: 750 }}
        components={{
          event: WeeklyEventCard,
        }}
        eventPropGetter={(event) => getReservationEventStyle(event as TimetableReservation)}
        formats={{
          dayFormat: (date) => format(date, 'M/d (EEE)', { locale: ko }),
          eventTimeRangeFormat: () => '',
        }}
        messages={{
          work_week: 'WEEKLY',
          today: '오늘',
          previous: '‹',
          next: '›',
          noEventsInRange: '예약이 없습니다.',
        }}
        onSelectSlot={(slotInfo: SlotInfo) => onSelectSlot(slotInfo.start, slotInfo.end)}
        onSelectEvent={(event) => onSelectReservation?.(event as TimetableReservation)}
      />
    </div>
  );
}

export default WeeklyTimetable;
export { getReservationEventStyle, getReservationOwnerName };
