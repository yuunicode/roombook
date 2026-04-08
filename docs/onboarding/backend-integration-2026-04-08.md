# 백엔드 연동 작업 로그 (2026-04-08)

## 목표

- 회의록 Wiki/회의록 수정 화면을 백엔드 데이터 기준으로 동작시키기
- 라벨/회의록 필드/참석자 데이터의 서버 저장 구조 추가
- 단일 편집자 잠금 API(초기 버전) 추가

## 백엔드 변경

1. 예약 모델 확장
- `reservations`에 다음 컬럼 추가
  - `label`
  - `external_attendees`
  - `agenda`
  - `meeting_content`
  - `meeting_result`
  - `minutes_attachment`

2. 회의록 잠금 테이블 추가
- `minutes_locks`
  - `reservation_id` (PK)
  - `holder_user_id`
  - `holder_name`
  - `expires_at`
  - `updated_at`

3. 신규/확장 API
- `GET /api/users` (전체 사용자 목록)
- `GET /api/reservations` (Wiki 목록 + 필터)
- `GET /api/reservations/{id}/minutes` (회의록 상세)
- `PATCH /api/reservations/{id}/minutes` (회의록 수정)
- `GET/POST/DELETE /api/reservations/{id}/minutes-lock` (수정 잠금)
- 기존 `/api/reservations` create/update에도 회의록 필드 반영

4. 마이그레이션
- `backend/alembic/versions/20260408_01_minutes_fields_and_lock.py`

## 프론트 변경

1. API 클라이언트 확장 (`src/api/index.ts`)
- 로그인/비밀번호 변경/유저 목록/예약 목록/예약 생성/회의록 수정/예약 삭제 연결

2. 전역 상태 API 동기화 (`src/stores/appState.tsx`)
- 로그인 사용자 기준으로 `users`, `reservations` 서버 데이터 hydrate
- 예약 생성/수정/삭제를 서버 API로 저장
- 룸 ID 변환 규칙 추가 (`room-a` ↔ `A`)

3. 로그인 실 API 연동 (`src/pages/LoginPage.tsx`)
- 기존 가짜 로그인 제거, `/api/auth/login` 사용

4. 비밀번호 변경 API 파라미터 정합 수정 (`src/pages/ChangePasswordPage.tsx`)

5. 회의록 수정 잠금 API 연동 (`src/pages/MinutesPage.tsx`)
- 기존 localStorage 잠금을 제거하고 `minutes-lock` API 기반으로 변경
- 수정 진입/하트비트/해제 모두 서버 잠금으로 처리

## 검증

- 프론트
  - `npm run lint` 통과
  - `npm run build` 통과
- 백엔드
  - `uv run pytest` 통과 (13 passed)

## 다음 단계 (권장)

1. WebSocket/SSE로 잠금 상태와 회의록 변경 실시간 반영
2. 잠금 실패/세션 만료 에러를 사용자 안내 토스트로 세분화
3. 로컬스토리지 세션 의존 제거 후 `/api/auth/me` 기반 세션 복원
