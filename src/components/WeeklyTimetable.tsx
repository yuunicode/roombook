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
import { getReservationEventStyle } from './weeklyTimetableUtils';

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

export type TimetableReservation = CalendarEvent & {
  id: string;
  title: string;
  label: string;
  start: Date;
  end: Date;
  attendees: AppUser[];
  externalAttendees: string;
  agenda: string;
  meetingContent: string;
  meetingResult: string;
  minutesAttachment: string;
  creatorEmail: string;
  creatorName?: string;
};

type WeeklyTimetableProps = {
  reservations: TimetableReservation[];
  currentDate: Date;
  onNavigate: (nextDate: Date) => void;
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectReservation?: (reservation: TimetableReservation) => void;
  isSlotBlocked?: (start: Date, end: Date) => boolean;
};

function WeeklyEventCard({ event }: EventProps<TimetableReservation>) {
  const attendeeNames = (event.attendees ?? []).map((attendee) => attendee.name);
  const participantLine = attendeeNames.join(', ');
  const isCompactEvent =
    event.start instanceof Date &&
    event.end instanceof Date &&
    event.end.getTime() - event.start.getTime() <= 30 * 60 * 1000;
  const normalizedLabel = (event.label ?? '').trim();
  const titleLine =
    normalizedLabel && normalizedLabel !== '없음'
      ? `[${normalizedLabel}] ${event.title}`
      : event.title;

  return (
    <div className="weekly-event-card">
      <p className="weekly-event-title">{titleLine}</p>
      {!isCompactEvent ? (
        <p className="weekly-event-attendees">{participantLine || '참석자 없음'}</p>
      ) : null}
    </div>
  );
}

function WeeklyTimetable({
  reservations,
  currentDate,
  onNavigate,
  onSelectSlot,
  onSelectReservation,
  isSlotBlocked,
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
        onSelecting={(slotInfo) => {
          if (!isSlotBlocked) return true;
          return !isSlotBlocked(slotInfo.start, slotInfo.end);
        }}
        onSelectEvent={(event) => onSelectReservation?.(event as TimetableReservation)}
      />
    </div>
  );
}

export default WeeklyTimetable;
