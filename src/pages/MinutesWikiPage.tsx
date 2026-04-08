import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../stores';

function MinutesWikiPage() {
  const navigate = useNavigate();
  const { reservations, reservationLabels } = useAppState();

  const [recentMonthsFilter, setRecentMonthsFilter] = useState<'all' | '1' | '3' | '6' | '12'>(
    'all'
  );
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [attendeeFilter, setAttendeeFilter] = useState('');

  const labelOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...reservationLabels,
          ...reservations.map((reservation) => reservation.label).filter(Boolean),
        ])
      ).sort(),
    [reservationLabels, reservations]
  );

  const filteredReservations = useMemo(() => {
    const now = new Date();
    return reservations
      .filter((reservation) => {
        const creatorName = reservation.creatorEmail.split('@')[0] ?? reservation.creatorEmail;
        const month = reservation.start.getMonth() + 1;
        const day = reservation.start.getDate();
        const internalAttendees = reservation.attendees.map((attendee) => attendee.name).join(' ');
        const attendeeKeywordPool =
          `${internalAttendees} ${reservation.externalAttendees}`.toLowerCase();

        if (recentMonthsFilter !== 'all') {
          const threshold = new Date(now);
          threshold.setMonth(now.getMonth() - Number(recentMonthsFilter));
          if (reservation.start < threshold) return false;
        }
        if (monthFilter && month !== Number(monthFilter)) return false;
        if (dayFilter && day !== Number(dayFilter)) return false;
        if (labelFilter && reservation.label !== labelFilter) return false;
        if (creatorFilter && !creatorName.toLowerCase().includes(creatorFilter.toLowerCase()))
          return false;
        if (attendeeFilter && !attendeeKeywordPool.includes(attendeeFilter.toLowerCase()))
          return false;
        return true;
      })
      .sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [
    reservations,
    recentMonthsFilter,
    monthFilter,
    dayFilter,
    labelFilter,
    creatorFilter,
    attendeeFilter,
  ]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 0 40px' }}>
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h1 className="page-title" style={{ fontSize: '24px', marginBottom: '14px' }}>
          회의록 Wiki
        </h1>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div className="status-info-group">
            <label className="status-info-label">최근 기간</label>
            <select
              className="linear-input"
              value={recentMonthsFilter}
              onChange={(event) =>
                setRecentMonthsFilter(event.target.value as 'all' | '1' | '3' | '6' | '12')
              }
            >
              <option value="all">전체</option>
              <option value="1">최근 1개월</option>
              <option value="3">최근 3개월</option>
              <option value="6">최근 6개월</option>
              <option value="12">최근 12개월</option>
            </select>
          </div>
          <div className="status-info-group">
            <label className="status-info-label">월</label>
            <select
              className="linear-input"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="">전체</option>
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
          <div className="status-info-group">
            <label className="status-info-label">일</label>
            <input
              className="linear-input"
              type="number"
              min={1}
              max={31}
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
              placeholder="전체"
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">라벨</label>
            <select
              className="linear-input"
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
            >
              <option value="">전체</option>
              {labelOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="status-info-group">
            <label className="status-info-label">예약자</label>
            <input
              className="linear-input"
              value={creatorFilter}
              onChange={(event) => setCreatorFilter(event.target.value)}
            />
          </div>
          <div className="status-info-group">
            <label className="status-info-label">참석자</label>
            <input
              className="linear-input"
              value={attendeeFilter}
              onChange={(event) => setAttendeeFilter(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: '1100px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 120px 260px 120px 160px 130px 130px',
              gap: '10px',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              background: '#fafafb',
            }}
          >
            <span className="status-info-label">날짜/시간</span>
            <span className="status-info-label">라벨</span>
            <span className="status-info-label">회의 제목</span>
            <span className="status-info-label">회의실</span>
            <span className="status-info-label">예약자</span>
            <span className="status-info-label">내부 참석자</span>
            <span className="status-info-label">바로가기</span>
          </div>

          {filteredReservations.map((reservation) => {
            const creatorName = reservation.creatorEmail.split('@')[0] ?? reservation.creatorEmail;
            const internalAttendeeCount = reservation.attendees.length;
            return (
              <div
                key={reservation.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 120px 260px 120px 160px 130px 130px',
                  gap: '10px',
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  {format(reservation.start, 'yyyy-MM-dd HH:mm')}
                </span>
                <span className="room-capacity-tag" style={{ width: 'fit-content' }}>
                  {reservation.label || '-'}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {reservation.title}
                </span>
                <span style={{ fontSize: '13px' }}>{reservation.room}</span>
                <span style={{ fontSize: '13px' }}>{creatorName}</span>
                <span style={{ fontSize: '13px' }}>{internalAttendeeCount}명</span>
                <button
                  className="nav-menu-item"
                  type="button"
                  onClick={() => navigate(`/minutes/${reservation.id}`)}
                >
                  보기
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default MinutesWikiPage;
