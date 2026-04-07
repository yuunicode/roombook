import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';
import brandMark from '../brand-mark.svg';

function ChangePasswordPage() {
  const navigate = useNavigate();
  const { isLoggedIn, userEmail, changePassword } = useAppState();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => { if (!isLoggedIn) navigate('/login'); }, [isLoggedIn, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('모든 필드를 입력해 주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    await changePassword(userEmail, newPassword);
    setIsSuccess(true);
    setTimeout(() => navigate('/'), 1500);
  };

  if (isSuccess) {
    return (
      <main className="auth-page-wrapper">
        <div className="auth-content-box" style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', background: '#f0fdf4', color: '#18794e', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '20px' }}>✓</div>
          <h1 className="brand-text" style={{ fontSize: '20px' }}>Password updated</h1>
          <p className="auth-secondary-action">Redirecting you to the home page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-wrapper">
      <div className="auth-content-box">
        <header className="auth-brand-center" onClick={() => navigate('/')}>
          <img className="brand-mark" src={brandMark} alt="" />
          <span className="brand-text">Roombook</span>
        </header>

        <form className="auth-form" onSubmit={handleChangePassword}>
          <div className="auth-input-group">
            <label className="auth-label">Current Password</label>
            <input className="auth-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="••••••••" autoFocus />
          </div>
          <div className="auth-input-group">
            <label className="auth-label">New Password</label>
            <input className="auth-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="At least 4 characters" />
          </div>
          <div className="auth-input-group">
            <label className="auth-label">Confirm New Password</label>
            <input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          
          {errorMessage && <p className="linear-error-message" style={{ textAlign: 'center' }}>{errorMessage}</p>}
          
          <button className="auth-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
          
          <button className="nav-menu-item" type="button" onClick={() => navigate('/')} style={{ marginTop: '8px' }}>
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}

export default ChangePasswordPage;
