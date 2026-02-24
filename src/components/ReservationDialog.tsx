import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';

type ReservationDraft = {
  title: string;
  attendees: string;
  reference: string;
  start: Date;
  end: Date;
};

type ReservationDialogProps = {
  isOpen: boolean;
  initialStart: Date;
  onClose: () => void;
  onConfirm: (draft: ReservationDraft) => void;
};

const START_HOUR = 9;
const END_HOUR = 18;

function createTimeSlots() {
  const slots: string[] = [];
  for (let minutes = START_HOUR * 60; minutes <= END_HOUR * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return slots;
}

const timeSlots = createTimeSlots();

function toTimeLabel(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function parseTimeLabel(timeLabel: string) {
  const [hours, minutes] = timeLabel.split(':').map((value) => Number(value));
  return { hours, minutes };
}

function toMinutes(timeLabel: string) {
  const { hours, minutes } = parseTimeLabel(timeLabel);
  return hours * 60 + minutes;
}

function formatDuration(startLabel: string, endLabel: string) {
  const start = toMinutes(startLabel);
  const end = toMinutes(endLabel);
  const totalMinutes = Math.max(end - start, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  if (hours > 0) {
    return `${hours}시간`;
  }
  return `${minutes}분`;
}

function ReservationDialog({ isOpen, initialStart, onClose, onConfirm }: ReservationDialogProps) {
  const [selectedDate, setSelectedDate] = useState(initialStart);
  const [activeMonth, setActiveMonth] = useState(
    new Date(initialStart.getFullYear(), initialStart.getMonth(), 1)
  );
  const [startTime, setStartTime] = useState<string | null>(toTimeLabel(initialStart));
  const [endTime, setEndTime] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    setSelectedDate(initialStart);
    setActiveMonth(new Date(initialStart.getFullYear(), initialStart.getMonth(), 1));
    setStartTime(toTimeLabel(initialStart));
    setEndTime(null);
  }, [initialStart, isOpen]);

  const normalizedRange = useMemo(() => {
    if (!startTime || !endTime) {
      return null;
    }

    const first = toMinutes(startTime);
    const second = toMinutes(endTime);
    const startLabel = first <= second ? startTime : endTime;
    const endLabel = first <= second ? endTime : startTime;

    return {
      startLabel,
      endLabel,
      startMinutes: Math.min(first, second),
      endMinutes: Math.max(first, second),
    };
  }, [startTime, endTime]);

  const selectedDateText = useMemo(
    () =>
      selectedDate.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [selectedDate]
  );

  if (!isOpen) {
    return null;
  }

  const handleTimeSlotClick = (slot: string) => {
    if (!startTime || (startTime && endTime)) {
      setStartTime(slot);
      setEndTime(null);
      return;
    }
    if (startTime === slot) {
      return;
    }
    setEndTime(slot);
  };

  const getSlotClassName = (slot: string) => {
    if (!startTime) {
      return '';
    }

    if (!endTime) {
      return slot === startTime ? 'start' : '';
    }

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    const minMinutes = Math.min(startMinutes, endMinutes);
    const maxMinutes = Math.max(startMinutes, endMinutes);
    const slotMinutes = toMinutes(slot);

    if (slotMinutes === minMinutes) {
      return 'start';
    }
    if (slotMinutes === maxMinutes) {
      return 'end';
    }
    if (slotMinutes > minMinutes && slotMinutes < maxMinutes) {
      return 'in-range';
    }
    return '';
  };

  const handleConfirm = () => {
    if (!title.trim() || !normalizedRange) {
      return;
    }

    const start = new Date(selectedDate);
    start.setHours(
      Math.floor(normalizedRange.startMinutes / 60),
      normalizedRange.startMinutes % 60,
      0,
      0
    );
    const end = new Date(selectedDate);
    end.setHours(
      Math.floor(normalizedRange.endMinutes / 60),
      normalizedRange.endMinutes % 60,
      0,
      0
    );

    onConfirm({
      title: title.trim(),
      attendees: attendees.trim(),
      reference: reference.trim(),
      start,
      end,
    });

    setTitle('');
    setAttendees('');
    setReference('');
    onClose();
  };

  const handleReset = () => {
    setStartTime(toTimeLabel(initialStart));
    setEndTime(null);
    setTitle('');
    setAttendees('');
    setReference('');
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="reservation-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="reservation-close-button"
          type="button"
          aria-label="닫기"
          onClick={onClose}
        >
          x
        </button>
        <div className="reservation-dialog-left">
          <h2 id="reservation-dialog-title" className="reservation-dialog-title">
            Reservation
          </h2>
          <DayPicker
            className="workday-picker"
            mode="single"
            locale={ko}
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            month={activeMonth}
            onMonthChange={setActiveMonth}
            weekStartsOn={1}
            showOutsideDays={false}
            hidden={{ dayOfWeek: [0, 6] }}
            formatters={{
              formatWeekdayName: (date) => date.toLocaleDateString('ko-KR', { weekday: 'short' }),
              formatCaption: (month) =>
                month.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }),
            }}
          />
          <p className="selected-day-text">{selectedDateText}</p>
          <p className="selected-time-text">
            {normalizedRange
              ? `${normalizedRange.startLabel} ~ ${normalizedRange.endLabel} (${formatDuration(normalizedRange.startLabel, normalizedRange.endLabel)})`
              : '시작 시간과 종료 시간을 선택하세요'}
          </p>
          <div className="time-slot-list">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                className={`time-slot-button ${getSlotClassName(slot)}`}
                type="button"
                onClick={() => handleTimeSlotClick(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div className="reservation-dialog-right">
          <label className="reservation-label" htmlFor="meeting-title">
            회의주제
          </label>
          <input
            id="meeting-title"
            className="reservation-input"
            type="text"
            placeholder="회의 주제를 입력하세요"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label className="reservation-label" htmlFor="meeting-attendees">
            참석자
          </label>
          <input
            id="meeting-attendees"
            className="reservation-input"
            type="text"
            placeholder="예: 홍길동, 김개발"
            value={attendees}
            onChange={(event) => setAttendees(event.target.value)}
          />

          <label className="reservation-label" htmlFor="meeting-reference">
            참고자료
          </label>
          <textarea
            id="meeting-reference"
            className="reservation-textarea"
            placeholder="링크 또는 메모를 입력하세요"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />

          <div className="reservation-actions">
            <button className="secondary-button" type="button" onClick={handleReset}>
              초기화
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleConfirm}
              disabled={!normalizedRange || !title.trim()}
            >
              예약
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ReservationDialog;
export type { ReservationDraft };
