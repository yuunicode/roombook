import { useState } from 'react';
import { APP_VERSION, RELEASE_NOTES_STORAGE_KEY } from '../constants';

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

export function useReleaseNotes() {
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [lastSeenReleaseVersion, setLastSeenReleaseVersion] = useState<string | null>(() =>
    getLastSeenReleaseVersion()
  );

  const hasUnreadRelease = lastSeenReleaseVersion !== APP_VERSION;

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
