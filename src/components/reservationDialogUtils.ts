import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { parse } from 'date-fns';
import type { AppUser } from '../stores';

export const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h += 1) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 18) slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
})();

const MAX_BULLET_LEVEL = 4;
const BULLET_SYMBOLS = ['•', '◦', '▪', '▫'] as const;
const BULLET_PATTERN = /^(\t{0,3})([•◦▪▫])\s?(.*)$/;

function getBulletPrefix(level: number) {
  const normalized = Math.max(0, Math.min(level, BULLET_SYMBOLS.length - 1));
  return `${BULLET_SYMBOLS[normalized]} `;
}

type UseReservationTimeSelectionOptions = {
  selectedDate: Date | undefined;
  startTime: string;
  endTime: string;
  isSelectingEnd: boolean;
  isRangeBlocked: (start: Date, end: Date) => boolean;
  setStartTime: Dispatch<SetStateAction<string>>;
  setEndTime: Dispatch<SetStateAction<string>>;
  setIsSelectingEnd: Dispatch<SetStateAction<boolean>>;
  enabled?: boolean;
};

export function useReservationTimeSelection({
  selectedDate,
  startTime,
  endTime,
  isSelectingEnd,
  isRangeBlocked,
  setStartTime,
  setEndTime,
  setIsSelectingEnd,
  enabled = true,
}: UseReservationTimeSelectionOptions) {
  const blockedStartSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>();
    const locked = new Set<string>();
    for (let i = 0; i < TIME_SLOTS.length - 1; i += 1) {
      const segmentStart = parse(TIME_SLOTS[i], 'HH:mm', selectedDate);
      const segmentEnd = parse(TIME_SLOTS[i + 1], 'HH:mm', selectedDate);
      if (isRangeBlocked(segmentStart, segmentEnd)) {
        locked.add(TIME_SLOTS[i]);
      }
    }
    // 18:00 is only a valid end time in the current 30-minute grid.
    locked.add(TIME_SLOTS[TIME_SLOTS.length - 1]);
    return locked;
  }, [isRangeBlocked, selectedDate]);

  const blockedEndSlots = useMemo(() => {
    if (!selectedDate || !startTime) return new Set<string>();

    const locked = new Set<string>();
    const rangeStart = parse(startTime, 'HH:mm', selectedDate);

    for (const slot of TIME_SLOTS) {
      const candidateEnd = parse(slot, 'HH:mm', selectedDate);
      if (candidateEnd <= rangeStart || isRangeBlocked(rangeStart, candidateEnd)) {
        locked.add(slot);
      }
    }

    return locked;
  }, [isRangeBlocked, selectedDate, startTime]);

  useEffect(() => {
    if (!enabled || !selectedDate) return;
    if (!startTime || !endTime) return;
    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);
    if (end <= start || isRangeBlocked(start, end) || blockedStartSlots.has(startTime)) {
      for (let i = 0; i < TIME_SLOTS.length - 1; i += 1) {
        const candidateStart = TIME_SLOTS[i];
        if (blockedStartSlots.has(candidateStart)) continue;
        const candidateEnd = TIME_SLOTS[i + 1];
        const rangeStart = parse(candidateStart, 'HH:mm', selectedDate);
        const rangeEnd = parse(candidateEnd, 'HH:mm', selectedDate);
        if (!isRangeBlocked(rangeStart, rangeEnd)) {
          setStartTime(candidateStart);
          setEndTime(candidateEnd);
          setIsSelectingEnd(false);
          return;
        }
      }
    }
  }, [
    blockedStartSlots,
    enabled,
    endTime,
    isRangeBlocked,
    selectedDate,
    setEndTime,
    setIsSelectingEnd,
    setStartTime,
    startTime,
  ]);

  const resetTimeSelection = useCallback(() => {
    setStartTime('');
    setEndTime('');
    setIsSelectingEnd(false);
  }, [setEndTime, setIsSelectingEnd, setStartTime]);

  const handleTimeClick = useCallback(
    (slot: string) => {
      if (!enabled || !selectedDate) return;

      if (!startTime) {
        if (blockedStartSlots.has(slot)) return;
        setStartTime(slot);
        setEndTime('');
        setIsSelectingEnd(true);
        return;
      }

      if (isSelectingEnd) {
        if (blockedEndSlots.has(slot)) return;
        setEndTime(slot);
        setIsSelectingEnd(false);
        return;
      }

      if (blockedStartSlots.has(slot)) return;
      setStartTime(slot);
      setEndTime('');
      setIsSelectingEnd(true);
    },
    [
      blockedEndSlots,
      blockedStartSlots,
      enabled,
      isSelectingEnd,
      selectedDate,
      setEndTime,
      setIsSelectingEnd,
      setStartTime,
      startTime,
    ]
  );

  return { blockedStartSlots, blockedEndSlots, handleTimeClick, resetTimeSelection };
}

export function filterReservationUsers(
  attendeeQuery: string,
  selectedAttendees: AppUser[],
  users: AppUser[]
) {
  const keyword = attendeeQuery.trim().toLowerCase();
  if (!keyword) return [];

  const candidates = users.filter(
    (user) => !selectedAttendees.some((attendee) => attendee.id === user.id)
  );

  const startsWithName = candidates.filter((user) => user.name.toLowerCase().startsWith(keyword));
  const includesName = candidates.filter(
    (user) =>
      !user.name.toLowerCase().startsWith(keyword) && user.name.toLowerCase().includes(keyword)
  );
  const includesEmail = candidates.filter(
    (user) =>
      !user.name.toLowerCase().includes(keyword) && user.email.toLowerCase().includes(keyword)
  );

  return [...startsWithName, ...includesName, ...includesEmail].slice(0, 6);
}

export function useAgendaBulletKeyDown(setAgenda: Dispatch<SetStateAction<string>>) {
  return useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget;
      const value = textarea.value;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;

      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const nextLineBreakIndex = value.indexOf('\n', selectionStart);
      const lineEnd = nextLineBreakIndex === -1 ? value.length : nextLineBreakIndex;
      const line = value.slice(lineStart, lineEnd);
      const lineBeforeCursor = value.slice(lineStart, selectionStart);

      const setAgendaWithCursor = (nextValue: string, cursor: number) => {
        setAgenda(nextValue);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(cursor, cursor);
        });
      };

      if (event.key === '-') {
        if (selectionStart !== selectionEnd) return;
        if (!/^\t*$/.test(lineBeforeCursor)) return;
        event.preventDefault();
        const bullet = getBulletPrefix(Math.min(lineBeforeCursor.length, MAX_BULLET_LEVEL - 1));
        const nextValue = `${value.slice(0, selectionStart)}${bullet}${value.slice(selectionEnd)}`;
        setAgendaWithCursor(nextValue, selectionStart + bullet.length);
        return;
      }

      if (event.key === 'Enter') {
        const bulletMatch = line.match(BULLET_PATTERN);
        if (!bulletMatch) return;
        event.preventDefault();
        const indent = bulletMatch[1] ?? '';
        const insert = `\n${indent}${getBulletPrefix(indent.length)}`;
        const nextValue = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
        setAgendaWithCursor(nextValue, selectionStart + insert.length);
        return;
      }

      if (event.key !== 'Tab') return;
      event.preventDefault();

      if (event.shiftKey) {
        const indentMatch = line.match(/^(\t{1,3})([•◦▪▫])\s?(.*)$/);
        if (indentMatch) {
          const nextIndent = indentMatch[1].slice(0, -1);
          const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${indentMatch[3]}`;
          const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
          setAgendaWithCursor(nextValue, Math.max(lineStart, selectionStart - 1));
          return;
        }

        const topLevelBulletMatch = line.match(/^([•◦▪▫])\s?(.*)$/);
        if (topLevelBulletMatch) {
          const nextLine = topLevelBulletMatch[2];
          const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
          setAgendaWithCursor(nextValue, Math.max(lineStart, selectionStart - 2));
        }
        return;
      }

      const nestedMatch = line.match(BULLET_PATTERN);
      if (nestedMatch) {
        const nextIndent = `${nestedMatch[1]}\t`;
        if (nextIndent.length >= MAX_BULLET_LEVEL) return;
        const nextLine = `${nextIndent}${getBulletPrefix(nextIndent.length)}${nestedMatch[3]}`;
        const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
        setAgendaWithCursor(nextValue, selectionStart + 1);
        return;
      }

      const plainLineMatch = line.match(/^(\t{0,4})(.*)$/);
      if (plainLineMatch) {
        const indent = plainLineMatch[1].slice(0, MAX_BULLET_LEVEL - 1);
        const bullet = getBulletPrefix(indent.length);
        const nextLine = `${indent}${bullet}${plainLineMatch[2]}`;
        const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
        setAgendaWithCursor(nextValue, selectionStart + bullet.length);
      }
    },
    [setAgenda]
  );
}
