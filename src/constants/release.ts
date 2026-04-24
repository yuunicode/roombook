import releaseManifest from '../../app-release.json';

export type ReleaseSection = {
  title: string;
  items: string[];
};

export type ReleaseEntry = {
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: ReleaseSection[];
};

type ReleaseManifest = {
  currentVersion: string;
  releases: ReleaseEntry[];
};

const manifest = releaseManifest as ReleaseManifest;

export const APP_VERSION = manifest.currentVersion;
export const RELEASES = manifest.releases;
export const CURRENT_RELEASE =
  RELEASES.find((release) => release.version === APP_VERSION) ?? RELEASES[0] ?? null;
export const RELEASE_NOTES_STORAGE_KEY = 'roombook:last-seen-release';
export const RELEASE_NOTES_DAILY_STORAGE_KEY = 'roombook:last-auto-opened-release-date';
