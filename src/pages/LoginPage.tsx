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

  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL ?? 'admin@ecminer.com').toLowerCase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('이메일과 비밀번호를 입력하세요.');
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setUserEmail(normalizedEmail);
    setIsSubmitting(false);

    if (normalizedEmail === adminEmail) {
      navigate('/admin/users');
    } else {
      navigate('/');
    }
  };

  return (
    <main className="linear-auth-container">
      <div className="linear-auth-card">
        <header className="linear-auth-header">
          <button className="linear-auth-brand" onClick={() => navigate('/')}>
            <img className="brand-mark" src={brandMark} alt="" aria-hidden="true" />
            <span className="brand-text">Roombook</span>
          </button>
          
          <div className="linear-auth-title-group">
            <h1 className="linear-auth-title">Log in</h1>
            <p className="linear-auth-description">
              Enter your email and password to access your account.
            </p>
          </div>
        </header>

        <form className="linear-auth-form" onSubmit={handleLogin}>
          <div className="linear-input-group">
            <label className="linear-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="linear-input"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="linear-input-group">
            <label className="linear-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="linear-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {errorMessage && <p className="linear-error-message">{errorMessage}</p>}
          
          <div className="linear-auth-form-footer">
            <button className="linear-primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
            <button 
              className="linear-secondary-button" 
              type="button" 
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;
