import { useEffect } from 'react';
import { getReleaseInfo } from '../api';
import { APP_VERSION } from '../constants';

const VERSION_REFRESH_GUARD_KEY = 'roombook:version-refresh-target';

function getReloadGuardVersion() {
  try {
    return window.sessionStorage.getItem(VERSION_REFRESH_GUARD_KEY);
  } catch {
    return null;
  }
}

function setReloadGuardVersion(version: string) {
  try {
    window.sessionStorage.setItem(VERSION_REFRESH_GUARD_KEY, version);
  } catch {
    // sessionStorage 접근이 막혀 있어도 UI는 동작해야 한다.
  }
}

function clearReloadGuardVersion() {
  try {
    window.sessionStorage.removeItem(VERSION_REFRESH_GUARD_KEY);
  } catch {
    // sessionStorage 접근이 막혀 있어도 UI는 동작해야 한다.
  }
}

export function useVersionRefresh() {
  useEffect(() => {
    let isCancelled = false;

    const checkLatestVersion = async () => {
      try {
        const release = await getReleaseInfo();
        if (isCancelled) return;

        const latestVersion = release.current_version.trim();
        if (!latestVersion || latestVersion === APP_VERSION) {
          clearReloadGuardVersion();
          return;
        }

        if (getReloadGuardVersion() === latestVersion) {
          return;
        }

        setReloadGuardVersion(latestVersion);
        window.location.reload();
      } catch {
        // 버전 확인 실패는 앱 사용을 막지 않는다.
      }
    };

    void checkLatestVersion();

    return () => {
      isCancelled = true;
    };
  }, []);
}
