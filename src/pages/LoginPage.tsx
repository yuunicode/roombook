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
    <main className="auth-page-wrapper">
      <div className="auth-content-box">
        <header className="auth-brand-center" onClick={() => navigate('/')}>
          <img className="brand-mark" src={brandMark} alt="" />
          <span className="brand-text">Roombook</span>
        </header>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-input-group">
            <label className="auth-label">Email</label>
            <input 
              className="auth-input" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="name@company.com" 
              autoFocus
            />
          </div>
          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <input 
              className="auth-input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••" 
            />
          </div>
          
          {errorMessage && <p className="linear-error-message" style={{ textAlign: 'center' }}>{errorMessage}</p>}
          
          <button className="auth-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          
          <button className="nav-menu-item" type="button" onClick={() => navigate('/')} style={{ marginTop: '8px' }}>
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;
