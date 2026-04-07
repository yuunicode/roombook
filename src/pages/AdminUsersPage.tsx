import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon } from '../components';
import { useAppState } from '../stores';

function AdminUsersPage() {
  const navigate = useNavigate();
  const { users, addUser } = useAppState();
  const [draft, setDraft] = useState({
    id: '',
    name: '',
    email: '',
    department: '',
    password: '',
  });
  const [statusMessage, setStatusMessage] = useState('프론트 우회 모드입니다. 여기서는 입력값 검증 없이 화면만 동작합니다.');

  const handleAddUser = () => {
    if (!draft.id.trim() || !draft.name.trim() || !draft.email.trim()) {
      setStatusMessage('id, name, email은 입력해야 합니다.');
      return;
    }

    addUser({
      id: draft.id.trim(),
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      department: draft.department.trim() || '-',
    });
    setDraft({
      id: '',
      name: '',
      email: '',
      department: '',
      password: '',
    });
    setStatusMessage('사용자 행이 프론트 상태에 추가되었습니다.');
  };

  return (
    <main className="admin-page">
      <header className="admin-card">
        <div className="page-title-block">
          <span className="page-title-icon-shell">
            <AppIcon name="users" className="page-title-icon" />
          </span>
          <div className="page-title-copy">
            <h1 className="admin-title">관리자 사용자 관리</h1>
            <p className="admin-subtitle">백엔드 인증 없이 화면만 진입 가능하도록 임시 우회한 상태입니다.</p>
          </div>
        </div>
      </header>

      <section className="admin-card">
        <div className="admin-section-title">사용자 추가</div>
        <div className="admin-form-grid">
          <input
            className="admin-input"
            type="text"
            placeholder="ID"
            value={draft.id}
            onChange={(event) => setDraft((prev) => ({ ...prev, id: event.target.value }))}
          />
          <input
            className="admin-input"
            type="text"
            placeholder="이름"
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="admin-input"
            type="email"
            placeholder="이메일"
            value={draft.email}
            onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="admin-input"
            type="text"
            placeholder="부서"
            value={draft.department}
            onChange={(event) => setDraft((prev) => ({ ...prev, department: event.target.value }))}
          />
          <input
            className="admin-input"
            type="password"
            placeholder="비밀번호"
            value={draft.password}
            onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
          />
          <button className="dialog-login-button" type="button" onClick={handleAddUser}>
            사용자 추가
          </button>
        </div>
        <p className="admin-status">{statusMessage}</p>
      </section>

      <section className="admin-card">
        <div className="admin-section-title">현재 사용자 목록</div>
        <div className="admin-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>이메일</th>
                <th>부서</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={`${user.id}-${user.email}`}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button className="secondary-button" type="button" onClick={() => navigate('/')}>
        <AppIcon name="arrow-left" className="button-icon" />
        메인으로
      </button>
    </main>
  );
}

export default AdminUsersPage;
