import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUserAiUsage, type UserAiUsageDto, type UserAiUsageOverviewDto } from '../api';
import { useAppState } from '../stores';

const DEPARTMENT_OPTIONS = ['컨설팅', 'R&D센터', '사업본부'] as const;

function formatUsd(value: number) {
  return `$ ${value.toFixed(4)}`;
}

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
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [labelRename, setLabelRename] = useState<Record<string, string>>({});
  const [aiUsageRows, setAiUsageRows] = useState<UserAiUsageDto[]>([]);
  const [aiUsageSummary, setAiUsageSummary] = useState<UserAiUsageOverviewDto['summary'] | null>(
    null
  );
  const [aiUsageSearchQuery, setAiUsageSearchQuery] = useState('');
  const [isAiUsageLoading, setIsAiUsageLoading] = useState(false);
  const [aiUsageError, setAiUsageError] = useState('');

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );
  const adminUsers = useMemo(() => sortedUsers.filter((user) => user.isAdmin), [sortedUsers]);
  const adminCandidates = useMemo(() => {
    const keyword = adminSearchQuery.trim().toLowerCase();
    if (!keyword) return [];
    return sortedUsers
      .filter(
        (user) =>
          !user.isAdmin &&
          (user.id.toLowerCase().includes(keyword) ||
            user.name.toLowerCase().includes(keyword) ||
            user.email.toLowerCase().includes(keyword))
      )
      .slice(0, 8);
  }, [adminSearchQuery, sortedUsers]);
  const filteredAiUsageRows = useMemo(() => {
    const keyword = aiUsageSearchQuery.trim().toLowerCase();
    if (!keyword) return aiUsageRows;
    return aiUsageRows.filter(
      (row) =>
        row.user_id.toLowerCase().includes(keyword) ||
        row.name.toLowerCase().includes(keyword) ||
        row.email.toLowerCase().includes(keyword)
    );
  }, [aiUsageRows, aiUsageSearchQuery]);

  useEffect(() => {
    if (!isLoggedIn || !isCurrentUserAdmin) return;

    let cancelled = false;
    const loadAiUsage = async () => {
      setIsAiUsageLoading(true);
      setAiUsageError('');
      try {
        const overview = await listUserAiUsage();
        if (cancelled) return;
        setAiUsageSummary(overview.summary);
        setAiUsageRows(overview.items);
      } catch (error) {
        if (cancelled) return;
        setAiUsageError(error instanceof Error ? error.message : 'AI 사용량 조회 실패');
      } finally {
        if (!cancelled) {
          setIsAiUsageLoading(false);
        }
      }
    };

    void loadAiUsage();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, isCurrentUserAdmin]);

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

      <section style={{ display: 'grid', gap: '14px' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ margin: '0 0 10px', fontSize: '14px' }}>관리자 권한부여</h3>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-soft)' }}>
            관리자는 최소 1명 이상 유지되어야 합니다.
          </p>
          <div style={{ position: 'relative' }}>
            <input
              className="linear-input"
              placeholder="ID / 이름 / 이메일로 사용자 검색"
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
            />
            {adminSearchQuery.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  zIndex: 20,
                  maxHeight: '220px',
                  overflow: 'auto',
                }}
              >
                {adminCandidates.length > 0 ? (
                  adminCandidates.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                      }}
                    >
                      <span>
                        {user.name} ({user.id}) · {user.email}
                      </span>
                      <button
                        className="nav-menu-item"
                        style={{ height: '28px' }}
                        onClick={async () => {
                          const ok = window.confirm(
                            `${user.name}(${user.id}) 사용자에게 관리자 권한을 부여하시겠습니까?`
                          );
                          if (!ok) return;
                          try {
                            await setUserAdmin(user.id, true);
                            setAdminSearchQuery('');
                          } catch (error) {
                            alert(error instanceof Error ? error.message : '권한 부여 실패');
                          }
                        }}
                      >
                        권한 부여
                      </button>
                    </div>
                  ))
                ) : (
                  <p
                    style={{
                      margin: 0,
                      padding: '10px',
                      fontSize: '12px',
                      color: 'var(--text-soft)',
                    }}
                  >
                    검색 결과가 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: '12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '300px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 120px 1fr 100px 100px',
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
              <span>권한</span>
            </div>
            {adminUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 120px 1fr 100px 100px',
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
                <span>{user.email}</span>
                <span>{user.department}</span>
                <button
                  className="nav-menu-item"
                  style={{ height: '28px' }}
                  disabled={adminUsers.length <= 1}
                  onClick={async () => {
                    if (adminUsers.length <= 1) {
                      alert('관리자는 최소 1명 이상이어야 합니다.');
                      return;
                    }
                    const ok = window.confirm(
                      `${user.name}(${user.id}) 사용자의 관리자 권한을 해제하시겠습니까?`
                    );
                    if (!ok) return;
                    try {
                      await setUserAdmin(user.id, false);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : '권한 해제 실패');
                    }
                  }}
                >
                  해제
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
            minHeight: '360px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '10px',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '14px' }}>AI 사용량 조회</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-soft)' }}>
                전사 총 한도로 차단하고, 사용자별 누적 사용 금액을 함께 기록합니다.
              </p>
            </div>
            <button
              className="nav-menu-item"
              style={{ height: '32px', flexShrink: 0 }}
              onClick={async () => {
                setIsAiUsageLoading(true);
                setAiUsageError('');
                try {
                  const overview = await listUserAiUsage();
                  setAiUsageSummary(overview.summary);
                  setAiUsageRows(overview.items);
                } catch (error) {
                  setAiUsageError(error instanceof Error ? error.message : 'AI 사용량 조회 실패');
                } finally {
                  setIsAiUsageLoading(false);
                }
              }}
            >
              새로고침
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 280px) auto',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <input
              className="linear-input"
              placeholder="ID / 이름 / 이메일 검색"
              value={aiUsageSearchQuery}
              onChange={(event) => setAiUsageSearchQuery(event.target.value)}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '16px',
                fontSize: '12px',
                color: 'var(--text-soft)',
                paddingRight: '4px',
              }}
            >
              <span>기준 월: {aiUsageSummary?.period_month ?? '-'}</span>
              <span>
                전사 한도: {aiUsageSummary ? formatUsd(aiUsageSummary.monthly_limit_usd) : '-'}
              </span>
              <span>사용: {aiUsageSummary ? formatUsd(aiUsageSummary.used_usd) : '-'}</span>
              <span>잔여: {aiUsageSummary ? formatUsd(aiUsageSummary.remaining_usd) : '-'}</span>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 110px 1fr 90px 120px 150px',
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
              <span>사용 금액</span>
              <span>최근 반영</span>
            </div>

            {isAiUsageLoading ? (
              <p
                style={{ margin: 0, padding: '14px', fontSize: '12px', color: 'var(--text-soft)' }}
              >
                불러오는 중...
              </p>
            ) : aiUsageError ? (
              <p style={{ margin: 0, padding: '14px', fontSize: '12px', color: '#e5484d' }}>
                {aiUsageError}
              </p>
            ) : filteredAiUsageRows.length === 0 ? (
              <p
                style={{ margin: 0, padding: '14px', fontSize: '12px', color: 'var(--text-soft)' }}
              >
                표시할 사용량 데이터가 없습니다.
              </p>
            ) : (
              filteredAiUsageRows.map((row) => (
                <div
                  key={row.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 110px 1fr 90px 120px 150px',
                    gap: '8px',
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  <span>{row.user_id}</span>
                  <span>{row.name}</span>
                  <span style={{ textAlign: 'left' }}>{row.email}</span>
                  <span>{row.department}</span>
                  <span>{formatUsd(row.used_usd)}</span>
                  <span>
                    {row.updated_at ? row.updated_at.slice(0, 16).replace('T', ' ') : '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px',
              minHeight: '640px',
              maxHeight: '640px',
              display: 'flex',
              flexDirection: 'column',
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
                flex: 1,
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 120px 1fr 100px 80px',
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
                <span>퇴사</span>
              </div>
              {sortedUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 120px 1fr 100px 80px',
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
                  <span>{user.email}</span>
                  <span>{user.department}</span>
                  <button
                    className="nav-menu-item"
                    style={{ height: '28px', color: '#e5484d' }}
                    onClick={async () => {
                      const ok = window.confirm(
                        `${user.name}(${user.id}) 사용자를 퇴사 처리하시겠습니까?\n퇴사 처리 후 로그인할 수 없습니다.`
                      );
                      if (!ok) return;
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
              minHeight: '520px',
              maxHeight: '520px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '14px' }}>라벨 관리</h3>
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-soft)' }}>
              기본 라벨은 "없음"이며, 라벨 제거 시 기존 예약 라벨은 자동으로 "없음"으로 변경됩니다.
            </p>
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
                flex: 1,
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
                    onChange={(e) =>
                      setLabelRename((prev) => ({ ...prev, [label]: e.target.value }))
                    }
                  />
                  <button
                    className="nav-menu-item"
                    style={{ height: '28px' }}
                    onClick={async () => {
                      try {
                        await renameReservationLabel(label, (labelRename[label] ?? label).trim());
                        alert('변경되었습니다.');
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
                      const ok = window.confirm(
                        `"${label}" 라벨을 제거하시겠습니까?\n기존 예약 라벨은 자동으로 "없음"으로 변경됩니다.`
                      );
                      if (!ok) return;
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
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminPage;
