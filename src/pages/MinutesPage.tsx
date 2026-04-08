import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../stores';
import { AppIcon } from '../components';

type TranscriptItem = {
  id: string;
  speaker: string;
  text: string;
  time: string;
};

function MinutesPage() {
  const { isLoggedIn } = useAppState();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // STT 시뮬레이션 로직 (백엔드 연결 전 프론트엔드 목업)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      const mockTexts = [
        "안녕하세요, 오늘 프로젝트 일정 논의 시작하겠습니다.",
        "네, 현재 1단계 개발은 완료된 상태입니다.",
        "다음 주까지 디자인 시스템 가이드 보완이 필요할 것 같아요.",
        "예약 시스템의 버그 수정 건은 어떻게 진행되고 있나요?",
        "그 부분은 오늘 오후 중에 마무리될 예정입니다."
      ];
      let i = 0;
      interval = setInterval(() => {
        if (i < mockTexts.length) {
          const newItem: TranscriptItem = {
            id: String(Date.now()),
            speaker: i % 2 === 0 ? "나" : "동료",
            text: mockTexts[i],
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setTranscripts(prev => [...prev, newItem]);
          i++;
        }
      }, 2000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    setTranscripts([]);
    setIsRecording(true);
    setHasRecorded(false);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setHasRecorded(true);
  };

  const handleConvert = () => {
    if (transcripts.length === 0) return;
    
    // 시뮬레이션: STT 내용을 기반으로 요약본 생성
    const summary = transcripts.map(t => `- [${t.speaker}] ${t.text}`).join('\n');
    setTitle(`${new Date().toLocaleDateString()} 회의록 (자동 생성됨)`);
    setContent(`[회의 요약]\n${summary}\n\n[결정 사항]\n- 프로젝트 일정 준수 확인\n- 디자인 시스템 보완 필요`);
  };

  if (!isLoggedIn) {
    return (
      <div className="empty-page-state">
        <h2 className="page-title">로그인이 필요합니다</h2>
        <p className="page-subtitle">회의록 작성을 위해 먼저 로그인해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="minutes-container">
      {/* 왼쪽: STT 전사 영역 */}
      <section className="minutes-stt-section">
        <header className="stt-header">
          <div className="stt-status">
            <div className={`status-dot ${isRecording ? 'recording' : ''}`} />
            <span className="status-text">{isRecording ? 'GPT-4o-mini-transcribe 분석 중...' : '준비 완료'}</span>
          </div>
          <h2 className="section-small-title">Real-time Transcript</h2>
        </header>

        <div className="stt-transcript-area" ref={scrollRef}>
          {transcripts.length === 0 ? (
            <div className="stt-empty">
              <AppIcon name="room" style={{ width: '32px', opacity: 0.2, marginBottom: '12px' }} />
              <p>녹음 시작 버튼을 눌러 회의를 기록하세요.</p>
            </div>
          ) : (
            transcripts.map(item => (
              <div key={item.id} className={`transcript-bubble ${item.speaker === '나' ? 'me' : 'other'}`}>
                <span className="bubble-speaker">{item.speaker}</span>
                <p className="bubble-text">{item.text}</p>
                <span className="bubble-time">{item.time}</span>
              </div>
            ))
          )}
        </div>

        <footer className="stt-controls">
          {!isRecording ? (
            <button className="linear-primary-button record-start" onClick={handleStartRecording}>
              <div className="record-icon" />
              녹음 시작
            </button>
          ) : (
            <button className="linear-primary-button record-stop" onClick={handleStopRecording}>
              <div className="stop-icon" />
              녹음 종료
            </button>
          )}
          
          {hasRecorded && (
            <button className="linear-primary-button convert-button" onClick={handleConvert}>
              <AppIcon name="calendar" style={{ width: '14px' }} />
              Convert to Minutes
            </button>
          )}
        </footer>
      </section>

      {/* 오른쪽: 회의록 편집 영역 */}
      <section className="minutes-edit-section">
        <header className="page-header-content" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h1 className="page-title" style={{ fontSize: '24px' }}>Meeting Minutes</h1>
          <p className="page-subtitle">작성된 내용을 확인하고 저장하세요.</p>
        </header>

        <div className="minutes-form-container">
          <div className="linear-form-group">
            <label className="linear-label">제목</label>
            <input 
              className="linear-input" 
              placeholder="회의 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="linear-form-group">
            <label className="linear-label">본문</label>
            <textarea 
              className="minutes-textarea" 
              placeholder="내용을 입력하거나 Convert 버튼을 눌러보세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button className="linear-primary-button save-button">저장하기</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MinutesPage;
