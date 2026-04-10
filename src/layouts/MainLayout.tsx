import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import brandMark from '../brand-mark.svg';
import { AppIcon } from '../components';
import { useAppState } from '../stores';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, userEmail, users, logout } = useAppState();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const displayName = isLoggedIn
    ? (users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase())?.name ??
      userEmail.split('@')[0])
    : '';

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/');
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
            <div className="user-profile-wrapper">
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
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-soft)' }}>{userEmail}</p>
                  </div>
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
    </div>
  );
}

export default MainLayout;
