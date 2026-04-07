import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';
import brandMark from '../brand-mark.svg';

function LoginPage() {
  const navigate = useNavigate();
  const { setUserEmail } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setUserEmail(email.trim().toLowerCase());
    setIsSubmitting(false);
    navigate('/');
  };

  return (
    <main className="linear-auth-container">
      <div className="linear-auth-card">
        <header style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
          <div className="brand-area" onClick={() => navigate('/')}>
            <img className="brand-mark" src={brandMark} alt="" />
            <span className="brand-text">Roombook</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1 className="linear-auth-title">Log in</h1>
            <p className="linear-auth-description">Enter your email and password to access your account.</p>
          </div>
        </header>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-soft)' }}>Email</label>
            <input className="linear-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-soft)' }}>Password</label>
            <input className="linear-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {errorMessage && <p style={{ fontSize: '13px', color: '#e5484d' }}>{errorMessage}</p>}
          <button className="linear-primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
          <button className="nav-menu-item" type="button" onClick={() => navigate('/')} style={{ textAlign: 'center' }}>Cancel</button>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;
