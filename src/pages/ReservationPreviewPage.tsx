import { useMemo, useState } from 'react';
import {
  ReservationDialog,
  ReservationStatusDialog,
  type ReservationDraft,
  type ReservationStatus,
} from '../components';
import type { AppUser } from '../stores';

function buildPreviewDate() {
  const now = new Date();
  const base = new Date(now);
  base.setDate(now.getDate() + 1);
  base.setHours(0, 0, 0, 0);
  return base;
}

function withTime(baseDate: Date, hour: number, minute: number) {
  const value = new Date(baseDate);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function formatRange(start: Date, end: Date) {
  return `${start.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} - ${end.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}

const MOCK_USERS: AppUser[] = [
  {
    id: 'preview-admin',
    name: '구지윤',
    email: 'jykoo@ecminer.com',
    department: 'R&D센터',
    isAdmin: true,
  },
  {
    id: 'preview-user-1',
    name: '김형준',
    email: 'hjkim@ecminer.com',
    department: 'R&D센터',
    isAdmin: false,
  },
  {
    id: 'preview-user-2',
    name: '이한빛',
    email: 'hblee@ecminer.com',
    department: 'R&D센터',
    isAdmin: false,
  },
];

function ReservationPreviewPage() {
  const previewDate = useMemo(buildPreviewDate, []);
  const currentUser = MOCK_USERS[0];
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [startWithEmptyTimeSelection, setStartWithEmptyTimeSelection] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<ReservationStatus[]>(() => [
    {
      id: 'preview-rsv-1',
      title: '주간 운영 점검',
      label: '없음',
      attendees: [MOCK_USERS[0], MOCK_USERS[1]],
      externalAttendees: '',
      agenda: '- 지난 주 이슈 점검',
      meetingContent: '',
      meetingResult: '',
      otherNotes: '',
      minutesAttachment: '',
      start: withTime(previewDate, 10, 0),
      end: withTime(previewDate, 11, 0),
      creatorEmail: MOCK_USERS[0].email,
      creatorName: MOCK_USERS[0].name,
    },
    {
      id: 'preview-rsv-2',
      title: '고객 제안서 리뷰',
      label: '프로젝트A',
      attendees: [MOCK_USERS[0], MOCK_USERS[2]],
      externalAttendees: '외부 파트너 1명',
      agenda: '- 제안 방향 검토',
      meetingContent: '',
      meetingResult: '',
      otherNotes: '',
      minutesAttachment: '',
      start: withTime(previewDate, 13, 30),
      end: withTime(previewDate, 15, 0),
      creatorEmail: MOCK_USERS[0].email,
      creatorName: MOCK_USERS[0].name,
    },
    {
      id: 'preview-rsv-3',
      title: '후속 액션 정리',
      label: '긴급',
      attendees: [MOCK_USERS[1]],
      externalAttendees: '',
      agenda: '- 액션 아이템 확인',
      meetingContent: '',
      meetingResult: '',
      otherNotes: '',
      minutesAttachment: '',
      start: withTime(previewDate, 16, 30),
      end: withTime(previewDate, 17, 30),
      creatorEmail: MOCK_USERS[1].email,
      creatorName: MOCK_USERS[1].name,
    },
  ]);

  const selectedReservation = useMemo(
    () => reservations.find((item) => item.id === selectedReservationId) ?? null,
    [reservations, selectedReservationId]
  );

  const occupiedRanges = useMemo(
    () => reservations.map((item) => ({ start: item.start, end: item.end })),
    [reservations]
  );

  const createStart = withTime(previewDate, 9, 0);
  const createEnd = withTime(previewDate, 10, 0);

  const handleCreate = async (draft: ReservationDraft) => {
    setReservations((prev) => [
      ...prev,
      {
        id: `preview-rsv-${Date.now()}`,
        title: draft.title,
        label: draft.label,
        attendees: draft.attendees,
        externalAttendees: draft.externalAttendees,
        agenda: draft.agenda,
        meetingContent: draft.meetingContent,
        meetingResult: draft.meetingResult,
        otherNotes: draft.otherNotes,
        minutesAttachment: draft.minutesAttachment,
        start: draft.start,
        end: draft.end,
        creatorEmail: currentUser.email,
        creatorName: currentUser.name,
      },
    ]);
    setIsCreateOpen(false);
  };

  const handleSave = async (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>
  ) => {
    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              ...payload,
              creatorEmail: item.creatorEmail,
              creatorName: item.creatorName,
            }
          : item
      )
    );
  };

  const handleDelete = async (reservationId: string) => {
    setReservations((prev) => prev.filter((item) => item.id !== reservationId));
    setSelectedReservationId(null);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px 60px' }}>
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '18px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Frontend Preview
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: '28px', letterSpacing: '-0.03em' }}>
          예약 시간 선택 미리보기
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          백엔드 없이 시간 선택 UI만 직접 확인하는 페이지입니다. 시작 시간을 고른 뒤 종료 시간
          슬롯이 어떻게 잠기는지 확인해 보세요.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <button
            className="linear-primary-button"
            style={{ width: 'auto', padding: '0 18px' }}
            onClick={() => {
              setStartWithEmptyTimeSelection(false);
              setIsCreateOpen(true);
            }}
          >
            새 예약 다이얼로그 열기
          </button>
          <button
            className="nav-menu-item"
            style={{
              height: '40px',
              border: '1px solid var(--border)',
              background: '#fff',
              padding: '0 16px',
            }}
            onClick={() => {
              setStartWithEmptyTimeSelection(true);
              setIsCreateOpen(true);
            }}
          >
            빈 시간 선택 모드 열기
          </button>
        </div>
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>점유 시간 샘플</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              날짜: {previewDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <span className="status-badge">
            현재 예약 {reservations.length}건
          </span>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {reservations.map((reservation) => (
            <button
              key={reservation.id}
              type="button"
              onClick={() => setSelectedReservationId(reservation.id)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: '#fff',
                padding: '14px 16px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{reservation.title}</div>
                  <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {formatRange(reservation.start, reservation.end)} · {reservation.creatorName}
                  </div>
                </div>
                <span className="room-capacity-tag">{reservation.label || '없음'}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <ReservationDialog
        isOpen={isCreateOpen}
        initialStart={createStart}
        initialEnd={createEnd}
        startWithEmptyTimeSelection={startWithEmptyTimeSelection}
        currentUser={currentUser}
        users={MOCK_USERS}
        labelOptions={['없음', '프로젝트A', '긴급']}
        occupiedRanges={occupiedRanges}
        onClose={() => setIsCreateOpen(false)}
        onConfirm={handleCreate}
      />

      <ReservationStatusDialog
        isOpen={selectedReservation !== null}
        reservation={selectedReservation}
        currentUser={currentUser}
        users={MOCK_USERS}
        labelOptions={['없음', '프로젝트A', '긴급']}
        occupiedRanges={occupiedRanges}
        onClose={() => setSelectedReservationId(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default ReservationPreviewPage;
