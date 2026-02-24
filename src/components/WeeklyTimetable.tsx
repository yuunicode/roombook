import {
  Calendar,
  Views,
  dateFnsLocalizer,
  type Event as CalendarEvent,
  type SlotInfo,
} from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

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
  attendees: string;
  reference: string;
};

type WeeklyTimetableProps = {
  reservations: TimetableReservation[];
  onSelectSlot: (start: Date) => void;
};

function WeeklyTimetable({ reservations, onSelectSlot }: WeeklyTimetableProps) {
  return (
    <section className="timetable-card" aria-label="주간 타임테이블">
      <h2 className="section-title">이번 주 타임테이블</h2>
      <div className="rbc-wrapper">
        <Calendar
          localizer={localizer}
          events={reservations}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WORK_WEEK}
          views={[Views.WORK_WEEK]}
          selectable
          step={30}
          timeslots={1}
          min={new Date(1970, 1, 1, 9, 0, 0)}
          max={new Date(1970, 1, 1, 20, 0, 0)}
          style={{ height: 640 }}
          messages={{
            work_week: '주간',
            today: '오늘',
            previous: '이전',
            next: '다음',
            noEventsInRange: '예약이 없습니다.',
          }}
          onSelectSlot={(slotInfo: SlotInfo) => onSelectSlot(slotInfo.start)}
        />
      </div>
    </section>
  );
}

export default WeeklyTimetable;
