import { useEffect, useState } from 'react';
import {
  APP_VERSION,
  RELEASE_NOTES_DAILY_STORAGE_KEY,
  RELEASE_NOTES_STORAGE_KEY,
} from '../constants';

function getLastSeenReleaseVersion(): string | null {
  if (typeof window === 'undefined') {
    return APP_VERSION;
  }

  try {
    return window.localStorage.getItem(RELEASE_NOTES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCurrentReleaseVersion() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RELEASE_NOTES_STORAGE_KEY, APP_VERSION);
  } catch {
    // localStorage 접근이 막혀 있어도 UI는 동작해야 한다.
  }
}

function getTodayKey(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function getLastAutoOpenedDate(): string | null {
  if (typeof window === 'undefined') {
    return getTodayKey();
  }

  try {
    return window.localStorage.getItem(RELEASE_NOTES_DAILY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLastAutoOpenedDate(date: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RELEASE_NOTES_DAILY_STORAGE_KEY, date);
  } catch {
    // localStorage 접근이 막혀 있어도 UI는 동작해야 한다.
  }
}

export function useReleaseNotes() {
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [lastSeenReleaseVersion, setLastSeenReleaseVersion] = useState<string | null>(() =>
    getLastSeenReleaseVersion()
  );
  const [lastAutoOpenedDate, setLastAutoOpenedDate] = useState<string | null>(() =>
    getLastAutoOpenedDate()
  );

  const hasUnreadRelease = lastSeenReleaseVersion !== APP_VERSION;

  useEffect(() => {
    const today = getTodayKey();
    if (lastAutoOpenedDate === today) {
      return;
    }

    const autoOpenTimer = window.setTimeout(() => {
      storeLastAutoOpenedDate(today);
      storeCurrentReleaseVersion();
      setLastAutoOpenedDate(today);
      setLastSeenReleaseVersion(APP_VERSION);
      setIsReleaseNotesOpen(true);
    }, 0);

    return () => window.clearTimeout(autoOpenTimer);
  }, [lastAutoOpenedDate]);

  const openReleaseNotes = () => {
    setIsReleaseNotesOpen(true);
    if (!hasUnreadRelease) {
      return;
    }
    storeCurrentReleaseVersion();
    setLastSeenReleaseVersion(APP_VERSION);
  };

  const closeReleaseNotes = () => {
    setIsReleaseNotesOpen(false);
  };

  return {
    currentVersion: APP_VERSION,
    hasUnreadRelease,
    isReleaseNotesOpen,
    openReleaseNotes,
    closeReleaseNotes,
  };
}
