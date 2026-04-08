import type { TimetableReservation } from './WeeklyTimetable';

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

export { getReservationEventStyle, getReservationOwnerName };
