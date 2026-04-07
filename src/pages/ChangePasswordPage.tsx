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
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { setErrorMessage('모든 필드를 입력하세요.'); return; }
    if (newPassword !== confirmPassword) { setErrorMessage('새 비밀번호가 일치하지 않습니다.'); return; }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    await changePassword(userEmail, newPassword);
    setIsSuccess(true);
    setTimeout(() => navigate('/'), 1500);
  };

  if (isSuccess) {
    return (
      <main className="linear-auth-container">
        <div className="linear-auth-card" style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', background: '#f0fdf4', color: '#18794e', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
          <h1 className="linear-auth-title">Password updated</h1>
          <p className="linear-auth-description">Redirecting you to the home page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="linear-auth-container">
      <div className="linear-auth-card">
        <header style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
          <div className="brand-area" onClick={() => navigate('/')}>
            <img className="brand-mark" src={brandMark} alt="" />
            <span className="brand-text">Roombook</span>
          </div>
          <h1 className="linear-auth-title">Update password</h1>
        </header>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input className="linear-input" type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <input className="linear-input" type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <input className="linear-input" type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          {errorMessage && <p style={{ fontSize: '13px', color: '#e5484d' }}>{errorMessage}</p>}
          <button className="linear-primary-button" type="submit" disabled={isSubmitting}>Update password</button>
          <button className="nav-menu-item" type="button" onClick={() => navigate('/')}>Cancel</button>
        </form>
      </div>
    </main>
  );
}

export default ChangePasswordPage;
