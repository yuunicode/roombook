import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import brandMark from '../brand-mark.svg';
import { AppIcon, ReleaseNotesDialog } from '../components';
import { useReleaseNotes } from '../hooks';
import { useAppState } from '../stores';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, userEmail, users, isCurrentUserAdmin, logout } = useAppState();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    currentVersion,
    hasUnreadRelease,
    isReleaseNotesOpen,
    openReleaseNotes,
    closeReleaseNotes,
  } = useReleaseNotes();
  const displayName = isLoggedIn
    ? (users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase())?.name ??
      userEmail.split('@')[0])
    : '';

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: '회의실 예약', path: '/timetable' },
    { label: '회의록 Wiki', path: '/minutes-wiki' },
  ];

  return (
    <div className="app-layout">
      <header className="main-nav-header">
        <div className="header-left">
          <div className="brand-area" onClick={() => navigate('/')}>
            <img className="brand-mark" src={brandMark} alt="" />
            <span className="brand-text">Roombook</span>
          </div>
        </div>

        <nav className="header-center">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-menu-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-right">
          {!isLoggedIn ? (
            <button className="login-trigger" onClick={() => navigate('/login')}>
              LOGIN
            </button>
          ) : (
            <div className="user-profile-wrapper" ref={userMenuRef}>
              <button
                className={`user-profile-toggle ${isUserMenuOpen ? 'active' : ''}`}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <span className="user-name-text">{displayName}</span>
                <AppIcon
                  name="chevron-down"
                  className={`chevron-icon ${isUserMenuOpen ? 'open' : ''}`}
                />
              </button>

              {isUserMenuOpen && (
                <div className="user-dropdown-popover">
                  <div className="user-dropdown-section user-dropdown-identity">
                    <p style={{ fontSize: '11px', color: 'var(--text-soft)' }}>{userEmail}</p>
                  </div>
                  <div className="user-dropdown-section release-dropdown-summary">
                    <div>
                      <p className="user-dropdown-meta-label">현재 버전</p>
                      <p className="user-dropdown-meta-value">v{currentVersion}</p>
                    </div>
                    <button
                      type="button"
                      className="release-inline-button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openReleaseNotes();
                      }}
                    >
                      업데이트 내역
                      {hasUnreadRelease ? <span className="release-badge">NEW</span> : null}
                    </button>
                  </div>
                  {isCurrentUserAdmin ? (
                    <button
                      className="popover-item"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/admin');
                      }}
                    >
                      관리자 패널
                    </button>
                  ) : null}
                  <button
                    className="popover-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/change-password');
                    }}
                  >
                    비밀번호 변경
                  </button>
                  <button className="popover-item logout-item" onClick={handleLogout}>
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <ReleaseNotesDialog isOpen={isReleaseNotesOpen} onClose={closeReleaseNotes} />
    </div>
  );
}

export default MainLayout;
