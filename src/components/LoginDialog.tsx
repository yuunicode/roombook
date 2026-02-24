import { useState } from 'react';

type LoginDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string) => void;
};

function LoginDialog({ isOpen, onClose, onLogin }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      return;
    }
    onLogin(email.trim());
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="login-dialog-title" className="dialog-title">
          LOGIN
        </h2>
        <input
          className="dialog-input"
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="dialog-input"
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="dialog-login-button" type="button" onClick={handleLogin}>
          로그인하기
        </button>
      </section>
    </div>
  );
}

export default LoginDialog;
