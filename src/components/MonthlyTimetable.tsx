import React from 'react';
import {
  Calendar,
  Views,
  dateFnsLocalizer,
  type EventProps,
} from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  getReservationEventStyle,
  getReservationOwnerName,
} from './weeklyTimetableUtils';
import type { TimetableReservation } from './WeeklyTimetable';
import type { DateCellWrapperProps } from 'react-big-calendar';

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

/**
 * 월간 뷰 날짜 셀 클릭 시 정확한 날짜를 전달하기 위한 래퍼
 * CSS로 주말을 숨겼을 때 발생하는 좌표 오차를 무시하고 실제 데이터 날짜를 사용합니다.
 */
type DateCellWrapperWithSelectProps = DateCellWrapperProps & {
  onSelect: (date: Date) => void;
};

const DateCellWrapper = ({ children, value, onSelect }: DateCellWrapperWithSelectProps) => {
  const day = value.getDay();
  const isWeekend = day === 0 || day === 6;
  
  if (isWeekend) {
    return <div className="rbc-day-bg weekend-hidden" style={{ display: 'none' }} />;
  }

  return React.cloneElement(children, {
    onClick: () => onSelect(value),
    style: { ...children.props.style, cursor: 'pointer' }
  });
};

type MonthlyTimetableProps = {
  reservations: TimetableReservation[];
  currentDate: Date;
  onNavigate: (nextDate: Date) => void;
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectReservation?: (reservation: TimetableReservation) => void;
};

function MonthlyTimetable({
  reservations,
  currentDate,
  onNavigate,
  onSelectSlot,
  onSelectReservation,
}: MonthlyTimetableProps) {
  // onSelectSlot을 수동으로 호출하기 위한 핸들러
  const handleDayClick = (date: Date) => {
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(10, 0, 0, 0);
    onSelectSlot(start, end);
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
          dateCellWrapper: (props: DateCellWrapperProps) => (
            <DateCellWrapper {...props} onSelect={handleDayClick} />
          ),
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
