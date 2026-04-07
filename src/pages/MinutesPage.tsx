import { useState } from 'react';
import { useAppState } from '../stores';

function MinutesPage() {
  const { isLoggedIn } = useAppState();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해 주세요.');
      return;
    }
    alert('회의록이 저장되었습니다.');
    setTitle('');
    setContent('');
  };

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 className="page-title">로그인이 필요합니다</h2>
        <p className="page-subtitle">회의록 작성을 위해 먼저 로그인해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="minutes-page">
      <header className="page-header-content">
        <h1 className="page-title">회의록 작성</h1>
        <p className="page-subtitle">회의의 핵심 내용을 기록하고 공유하세요.</p>
      </header>

      <div className="minutes-form-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)' }}>회의 제목</label>
          <input 
            className="linear-input" 
            placeholder="예: 2026 Q2 제품 로드맵 기획 회의"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)' }}>내용</label>
          <textarea 
            className="minutes-textarea" 
            placeholder="주요 결정 사항 및 액션 아이템을 기록하세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="linear-primary-button" style={{ width: 'auto', padding: '0 32px' }} onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default MinutesPage;
