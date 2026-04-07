import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import type { AppUser } from '../stores';
import Dialog from './ui/Dialog';

type ReservationDraft = {
  title: string;
  attendees: AppUser[];
  externalAttendees?: string;
  agenda: string;
  minutesAttachment: string;
  start: Date;
  end: Date;
};

type ReservationDialogProps = {
  isOpen: boolean;
  initialStart: Date;
  initialEnd: Date;
  currentUser: AppUser | null;
  users: AppUser[];
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

function ReservationDialog({
  isOpen,
  initialStart,
  initialEnd,
  currentUser,
  users,
  onClose,
  onConfirm,
}: ReservationDialogProps) {
  const [selectedDate, setSelectedDate] = useState(initialStart);
  const [activeMonth, setActiveMonth] = useState(
    new Date(initialStart.getFullYear(), initialStart.getMonth(), 1)
  );
  const [startTime, setStartTime] = useState<string | null>(toTimeLabel(initialStart));
  const [endTime, setEndTime] = useState<string | null>(toTimeLabel(initialEnd));
  const [title, setTitle] = useState('');
  const [externalAttendees, setExternalAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [minutesAttachment, setMinutesAttachment] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<AppUser[]>([]);

  useEffect(() => {
    setSelectedDate(initialStart);
    setActiveMonth(new Date(initialStart.getFullYear(), initialStart.getMonth(), 1));
    setStartTime(toTimeLabel(initialStart));
    setEndTime(toTimeLabel(initialEnd));
  }, [initialStart, initialEnd, isOpen]);

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

  const filteredUsers = useMemo(() => {
    const keyword = attendeeQuery.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return users.filter((user) => {
      if (selectedAttendees.some((attendee) => attendee.id === user.id)) {
        return false;
      }
      return (
        user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)
      );
    });
  }, [attendeeQuery, selectedAttendees, users]);

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

  const handleAddAttendee = (user: AppUser) => {
    setSelectedAttendees((previous) => [...previous, user]);
    setAttendeeQuery('');
  };

  const handleRemoveAttendee = (userId: string) => {
    setSelectedAttendees((previous) => previous.filter((attendee) => attendee.id !== userId));
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
      attendees: selectedAttendees,
      externalAttendees: externalAttendees.trim(),
      agenda: agenda.trim(),
      minutesAttachment: minutesAttachment.trim(),
      start,
      end,
    });

    setTitle('');
    setSelectedAttendees([]);
    setExternalAttendees('');
    setAttendeeQuery('');
    setAgenda('');
    setMinutesAttachment('');
    onClose();
  };

  const handleReset = () => {
    setStartTime(toTimeLabel(initialStart));
    setEndTime(toTimeLabel(initialEnd));
    setTitle('');
    setSelectedAttendees([]);
    setExternalAttendees('');
    setAttendeeQuery('');
    setAgenda('');
    setMinutesAttachment('');
  };


  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="reservation-dialog-title"
      contentClassName="reservation-dialog-card"
      showCloseButton
      closeButtonClassName="reservation-close-button"
    >
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
        <label className="reservation-label" htmlFor="reservation-owner">
          예약자
        </label>
        <input
          id="reservation-owner"
          className="reservation-input"
          type="text"
          value={currentUser?.name ?? ''}
          readOnly
          disabled
          style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
        />

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
          placeholder="이름으로 검색하세요"
          value={attendeeQuery}
          onChange={(event) => setAttendeeQuery(event.target.value)}
        />
        <div className="reservation-attendee-chip-list">
          {selectedAttendees.map((attendee) => (
            <button
              key={attendee.id}
              className="reservation-attendee-chip"
              type="button"
              onClick={() => handleRemoveAttendee(attendee.id)}
            >
              {attendee.name}
            </button>
          ))}
        </div>
        <div className="reservation-attendee-suggestions">
          {filteredUsers.slice(0, 6).map((user) => (
            <button
              key={user.id}
              className="reservation-attendee-option"
              type="button"
              onClick={() => handleAddAttendee(user)}
            >
              <span>{user.name}</span>
              <span>{user.email}</span>
            </button>
          ))}
        </div>

        <label className="reservation-label" htmlFor="meeting-reference">
          회의 안건
        </label>
        <textarea
          id="meeting-reference"
          className="reservation-textarea reservation-agenda-textarea"
          placeholder="회의 안건을 입력하세요"
          value={agenda}
          onChange={(event) => setAgenda(event.target.value)}
        />

        <label className="reservation-label" htmlFor="meeting-minutes">
          첨부파일
        </label>
        <input
          id="meeting-minutes"
          className="reservation-input"
          type="text"
          placeholder="파일명 또는 링크"
          value={minutesAttachment}
          onChange={(event) => setMinutesAttachment(event.target.value)}
        />
        <input
          className="reservation-file-input"
          type="file"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) {
              setMinutesAttachment(selectedFile.name);
            }
          }}
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
    </Dialog>
  );
}

export default ReservationDialog;
export type { ReservationDraft };
