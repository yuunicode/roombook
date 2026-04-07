# 프론트엔드 온보딩 가이드

Roombook 프론트엔드는 Vite + React + TypeScript 기반의 회의실 예약 UI입니다. 메인 화면은 Linear에 가까운 중성 톤 UI 위에 주간/월간 캘린더와 예약 다이얼로그를 얹는 구조입니다.

## 프로젝트 개요

- 주간 뷰: 시간 슬롯 클릭으로 예약 생성
- 월간 뷰: 날짜 클릭으로 예약 생성
- 로그인: 이메일/비밀번호 기반 세션 쿠키 인증
- 사용자 기능: 마이페이지에서 본인 예약 또는 참석 중인 예약 확인
- 관리자 기능: 관리자 페이지에서 사용자 목록 관리

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Styling | 전역 CSS (`src/index.css`) |
| Calendar | `react-big-calendar` 기반 커스터마이징 |
| Backend API | FastAPI |

## 현재 프론트 구조

```text
src/
├── components/
│   ├── WeeklyTimetable.tsx
│   ├── MonthlyTimetable.tsx
│   ├── ReservationDialog.tsx
│   └── ReservationStatusDialog.tsx
├── pages/
│   ├── TimetablePage.tsx
│   ├── MyMeetingsPage.tsx
│   ├── AdminUsersPage.tsx
│   ├── LoginPage.tsx
│   └── ChangePasswordPage.tsx
├── stores/
│   └── appState.tsx
└── index.css
```

핵심 포인트

- UI 상태와 더미 사용자/예약 상태는 `src/stores/appState.tsx`에서 관리한다.
- 캘린더 테마와 다이얼로그 테마는 대부분 `src/index.css`에서 통합 조정한다.
- 예약 참석자는 문자열이 아니라 사용자 객체 배열 기반으로 다룬다.

## 로컬 실행

### Frontend

```bash
npm install
npm run dev
```

브라우저 기본 주소: `http://localhost:5173`

### Backend

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload --env-file .env
```

## 자주 보는 파일

- 메인 화면: `src/pages/TimetablePage.tsx`
- 주간 이벤트 렌더링: `src/components/WeeklyTimetable.tsx`
- 월간 이벤트 렌더링: `src/components/MonthlyTimetable.tsx`
- 전역 스타일: `src/index.css`
- 백엔드 API 진입점: `backend/app/main.py`
- 예약 라우터: `backend/app/router/reservation.py`

## 개발 메모

- 현재 로그인은 세션 쿠키 기반이며 별도 로그아웃 API는 없다.
- 예약 권한은 프론트와 백엔드가 완전히 같지 않을 수 있으니, 동작 변경 시 백엔드 서비스와 프론트를 함께 확인해야 한다.
- 사용자 데이터는 프론트 더미 상태와 백엔드 DB가 동시에 존재하므로, 실제 운영 전에는 어느 쪽이 기준인지 먼저 정리하는 편이 좋다.

## 사용자 DB 시드

`backend/scripts/seed_users.py`는 현재 async SQLAlchemy 기준으로 동작한다.

```bash
cd backend
uv run python scripts/seed_users.py
```

기본 비밀번호는 `ecminer`이고, 이미 존재하는 이메일은 건너뛴다.
