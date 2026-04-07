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

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('모든 필드를 입력해 주세요.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMessage('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (currentPassword.trim() === newPassword.trim()) {
      setErrorMessage('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMessage('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await changePassword(userEmail, newPassword);
      setIsSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <main className="linear-auth-container">
        <div className="linear-auth-card">
          <div className="linear-success-view">
            <div className="linear-success-icon">✓</div>
            <h1 className="linear-auth-title">Password updated</h1>
            <p className="linear-auth-description">
              Your password has been successfully updated.<br/>
              Redirecting you to the home page...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="linear-auth-container">
      <div className="linear-auth-card">
        <header className="linear-auth-header">
          <button className="linear-auth-brand" onClick={() => navigate('/')}>
            <img className="brand-mark" src={brandMark} alt="" aria-hidden="true" />
            <span className="brand-text">Roombook</span>
          </button>
          
          <div className="linear-auth-title-group">
            <h1 className="linear-auth-title">Update password</h1>
            <p className="linear-auth-description">
              Please enter your current password and choose a new one.
            </p>
          </div>
        </header>

        <form className="linear-auth-form" onSubmit={handleChangePassword}>
          <div className="linear-input-group">
            <label className="linear-label" htmlFor="current-password">
              Current Password
            </label>
            <input
              id="current-password"
              className="linear-input"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="linear-input-group">
            <label className="linear-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              className="linear-input"
              type="password"
              placeholder="At least 4 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="linear-input-group">
            <label className="linear-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              className="linear-input"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && <p className="linear-error-message">{errorMessage}</p>}
          
          <div className="linear-auth-form-footer">
            <button className="linear-primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update password'}
            </button>
            <button 
              className="linear-secondary-button" 
              type="button" 
              onClick={() => navigate('/')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default ChangePasswordPage;
