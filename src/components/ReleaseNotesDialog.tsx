import { CURRENT_RELEASE, RELEASES, type ReleaseEntry } from '../constants';
import Dialog from './ui/Dialog';

type ReleaseNotesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SECTION_TITLE_MAP: Record<string, string> = {
  Added: '추가',
  Changed: '변경',
  Fixed: '수정',
  'Known Issues': '알려진 이슈',
};

function formatReleaseDate(date: string) {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    return date;
  }
  return `${year}. ${month}. ${day}.`;
}

function ReleaseCard({ release }: { release: ReleaseEntry }) {
  const isCurrentRelease = CURRENT_RELEASE?.version === release.version;

  return (
    <article className={`release-card ${isCurrentRelease ? 'current' : ''}`}>
      <header className="release-card-header">
        <div>
          <div className="release-card-heading-row">
            <h3 className="release-card-title">{release.title}</h3>
            {isCurrentRelease ? <span className="release-current-badge">현재 배포</span> : null}
          </div>
          <p className="release-card-meta">
            v{release.version} · {formatReleaseDate(release.date)}
          </p>
        </div>
      </header>

      <p className="release-card-summary">{release.summary}</p>

      <div className="release-sections-grid">
        {release.sections.map((section) => (
          <section key={`${release.version}-${section.title}`} className="release-section">
            <h4 className="release-section-title">
              {SECTION_TITLE_MAP[section.title] ?? section.title}
            </h4>
            <ul className="release-section-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function ReleaseNotesDialog({ isOpen, onClose }: ReleaseNotesDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="release-notes-title"
      contentClassName="release-notes-dialog-card"
      showCloseButton
      closeButtonLabel="업데이트 내역 닫기"
    >
      <div className="release-notes-header">
        <p className="release-notes-kicker">Roombook Release Notes</p>
        <h2 id="release-notes-title" className="release-notes-title">
          업데이트 내역
        </h2>
        <p className="release-notes-subtitle">
          현재 배포된 버전과 최근 변경 사항을 한곳에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="release-notes-list">
        {RELEASES.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}
      </div>
    </Dialog>
  );
}

export default ReleaseNotesDialog;
