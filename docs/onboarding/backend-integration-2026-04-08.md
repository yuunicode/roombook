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

---

## 추가 작업 로그 (2026-04-09)

1. 회의 공간 DB 테이블 추가
- `rooms` 테이블 신설
  - `id` (`A`, `B`)
  - `name` (`회의실`, `회의테이블`)
  - `capacity`
  - `updated_at`
- 마이그레이션: `backend/alembic/versions/20260409_01_add_rooms_table.py`

2. 회의 공간 API 추가
- `GET /api/rooms` 추가 (인증 필요)
- 프론트 `spaces` 목록이 하드코딩이 아니라 DB 데이터를 사용하도록 변경

3. 예약/목록 반영 기준 통일
- 예약 데이터의 `room_id`, `room_name`을 그대로 사용
- `내 예약카드`, `Up next`, `내 다가오는 일정`, `회의록 Wiki`의 회의실 표시가 DB 기준 이름으로 동기화
- 프론트의 기존 `room-a ↔ A` 변환 로직 제거

4. 회의록 페이지 API 동기화 강화
- 회의록 페이지 진입 시 `GET /api/reservations/{id}/minutes`로 최신 데이터를 직접 조회
- 저장은 `PATCH /api/reservations/{id}/minutes` 응답을 `await`하여 성공/실패 메시지를 실제 서버 결과와 동기화
- 저장 성공 시 전역 예약 상태와 회의록 페이지 로컬 상태를 모두 최신 응답값으로 갱신

5. 관리자 권한/관리자 패널 추가 (2026-04-11)
- 사용자 권한 컬럼 추가: `users.is_admin`
- 예약 라벨 테이블 추가: `reservation_labels`
- 신규 마이그레이션: `20260411_01_admin_and_labels.py`
- 관리자 API 추가
  - `PATCH /api/users/{user_id}/admin` (관리자 권한 부여/해제)
  - `DELETE /api/users/{user_id}` (유저 삭제)
  - `GET/POST/PATCH/DELETE /api/labels` (라벨 조회/추가/변경/삭제)
- 라벨 삭제 시 해당 라벨을 쓰던 예약은 자동으로 `없음`으로 치환
- 프론트 관리자 패널(`/admin`) 추가
  - 사용자 추가/삭제/관리자 권한 부여
  - 라벨 추가/수정/삭제
  - 사용자 메뉴에서 `관리자 패널`을 `비밀번호 변경` 위에 배치
