import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';

const DEPARTMENT_OPTIONS = ['컨설팅', 'R&D센터', '사업본부'] as const;

function AdminPage() {
  const navigate = useNavigate();
  const {
    isLoggedIn,
    isCurrentUserAdmin,
    users,
    reservationLabels,
    addUser,
    removeUser,
    setUserAdmin,
    addReservationLabel,
    renameReservationLabel,
    removeReservationLabel,
  } = useAppState();

  const [newUser, setNewUser] = useState({
    id: '',
    name: '',
    department: 'R&D센터',
  });
  const [newLabel, setNewLabel] = useState('');
  const [labelRename, setLabelRename] = useState<Record<string, string>>({});

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  if (!isLoggedIn || !isCurrentUserAdmin) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">관리자만 접근할 수 있습니다</h2>
        <p className="page-subtitle">권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 0 40px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          관리자 패널
        </h1>
        <button className="nav-menu-item" onClick={() => navigate('/change-password')}>
          비밀번호 변경
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <h3 style={{ margin: '0 0 10px', fontSize: '14px' }}>사용자 관리</h3>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-soft)' }}>
            신규 사용자 기본 비밀번호는 ecminer 입니다. 생성 후 비밀번호 변경을 안내해 주세요.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <input
              className="linear-input"
              placeholder="id"
              value={newUser.id}
              onChange={(e) => setNewUser((p) => ({ ...p, id: e.target.value }))}
            />
            <input
              className="linear-input"
              placeholder="이름"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
            />
            <select
              className="linear-input"
              value={newUser.department}
              onChange={(e) => setNewUser((p) => ({ ...p, department: e.target.value }))}
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 14px', whiteSpace: 'nowrap', marginTop: 0 }}
              onClick={async () => {
                try {
                  await addUser(newUser);
                  setNewUser({ id: '', name: '', department: 'R&D센터' });
                } catch (error) {
                  alert(error instanceof Error ? error.message : '사용자 추가에 실패했습니다.');
                }
              }}
            >
              추가
            </button>
          </div>
          <div
            style={{
              maxHeight: '520px',
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 120px 1fr 100px 80px 80px',
                gap: '8px',
                padding: '8px 10px',
                background: '#fafafb',
                borderBottom: '1px solid var(--border)',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              <span>ID</span>
              <span>이름</span>
              <span>이메일</span>
              <span>부서</span>
              <span>관리자</span>
              <span>퇴사</span>
            </div>
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 120px 1fr 100px 80px 80px',
                  gap: '8px',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                <span>{user.id}</span>
                <span>{user.name}</span>
                <span style={{ textAlign: 'left' }}>{user.email}</span>
                <span>{user.department}</span>
                <button
                  className="nav-menu-item"
                  style={{ height: '28px' }}
                  onClick={async () => {
                    try {
                      await setUserAdmin(user.id, !user.isAdmin);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : '권한 변경 실패');
                    }
                  }}
                >
                  {user.isAdmin ? '해제' : '부여'}
                </button>
                <button
                  className="nav-menu-item"
                  style={{ height: '28px', color: '#e5484d' }}
                  onClick={async () => {
                    try {
                      await removeUser(user.id);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : '퇴사 처리 실패');
                    }
                  }}
                >
                  퇴사
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <h3 style={{ margin: '0 0 10px', fontSize: '14px' }}>라벨 관리</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <input
              className="linear-input"
              placeholder="새 라벨"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button
              className="linear-primary-button"
              style={{ width: 'auto', padding: '0 14px', whiteSpace: 'nowrap', marginTop: 0 }}
              onClick={async () => {
                try {
                  await addReservationLabel(newLabel);
                  setNewLabel('');
                } catch (error) {
                  alert(error instanceof Error ? error.message : '라벨 추가 실패');
                }
              }}
            >
              추가
            </button>
          </div>
          <div
            style={{
              maxHeight: '520px',
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          >
            {reservationLabels.map((label) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto auto',
                  gap: '8px',
                  padding: '8px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
                <input
                  className="linear-input"
                  value={labelRename[label] ?? label}
                  onChange={(e) => setLabelRename((prev) => ({ ...prev, [label]: e.target.value }))}
                />
                <button
                  className="nav-menu-item"
                  style={{ height: '28px' }}
                  onClick={async () => {
                    try {
                      await renameReservationLabel(label, (labelRename[label] ?? label).trim());
                    } catch (error) {
                      alert(error instanceof Error ? error.message : '라벨 수정 실패');
                    }
                  }}
                >
                  변경
                </button>
                <button
                  className="nav-menu-item"
                  style={{ height: '28px', color: '#e5484d' }}
                  disabled={label === '없음'}
                  onClick={async () => {
                    try {
                      await removeReservationLabel(label);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : '라벨 삭제 실패');
                    }
                  }}
                >
                  제거
                </button>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-soft)' }}>
            라벨 제거 시 기존 예약 라벨은 자동으로 "없음"으로 변경됩니다.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AdminPage;
