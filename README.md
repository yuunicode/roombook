# Meeting Room Reservation (FastAPI + React)

회의실 예약을 **타임테이블 중심 UI**로 빠르게 처리하는 사내용 웹앱입니다.
초기 진입 시 기본 회의실 **A**의 타임테이블이 보이고, **주간(그리드)** / **월간(캘린더)** UI를 자유롭게 전환할 수 있습니다.
인증은 **회사 도메인 이메일 + 비밀번호** 기반이며, 로그인 후에는 우측 상단에 **사용자 이름**이 표시됩니다(로그아웃 기능 없음).

---

## 주요 기능

### 타임테이블 UI
- **Weekly(주간)**: 시간 슬롯 그리드에서 클릭 → 예약 생성 다이얼로그 오픈
- **Monthly(월간)**: 날짜 셀 클릭 → 예약 생성 다이얼로그 오픈
  - 각 날짜 셀에 `2:00 회의명`, `3:00 회의명` 형태로 **스택(줄 단위) 표시**
  - 예약이 많으면 `+N more` 형태로 요약 가능
- 우측 상단 **[생성]** 버튼으로도 예약 다이얼로그 오픈

### 예약
- 예약 생성/조회/수정/삭제
- 동시성 충돌 시 **409 RESERVATION_CONFLICT** 반환 → 프론트에서 재조회로 UI 갱신

### 인증 (이메일/비밀번호)
- 우측 상단 [로그인] 클릭 → 이메일/비밀번호 입력
- 인증 성공 시 **세션 쿠키(HttpOnly)** 발급
- 세션 쿠키 유지 기간: **1년**
- 이후 사이트 접속 시 [로그인] 대신 **사용자 이름 표시**
- 사용자 메뉴에서 **로그아웃 가능**

### 참석자 태그(연동)
- 예약 생성/수정 시 참석자를 **태그/자동완성**으로 선택
- 권장 구조:
  - `GET /api/users/search?q=...`로 사내 사용자 검색 (백엔드가 사내 사용자 디렉터리를 직접 조회)

---

## 기술 스택

### Backend
- **FastAPI** + SQLAlchemy 2.0 (async)
- Session Cookie Auth (HttpOnly)
- DB: PostgreSQL
- Migration: Alembic

### Frontend
- React (Vite + TypeScript)
- 주간/월간 캘린더 UI 컴포넌트 구성
- API 통신: fetch

### Deployment
- QNAP NAS: Container Station + PostgreSQL 운영 가능
- 현재 운영 기준: `QNAP NAS(postgres-roombook:5432)` + `사내 PC(frontend/backend)`

## 현재 배포 기준

- NAS에는 PostgreSQL 컨테이너 `postgres-roombook`만 유지한다.
- frontend와 backend는 다른 사내 PC에서 `docker compose`로 실행한다.
- backend는 시작 시 NAS DB에 대해 마이그레이션과 사용자 시드를 자동 실행한다.

앱 호스트 PC에서는 저장소 루트에서 아래처럼 실행한다.

```bash
cp .env.app.example .env.app
# DATABASE_URL / SESSION_SIGNING_SECRET 수정
docker compose --env-file .env.app -f docker-compose.app.yml up -d --build
```

기본 포트:

- 프런트: `http://localhost:9090`
- 백엔드(개발/컨테이너 내부): `9191`

주의:

- QNAP Postgres 비밀번호는 저장소에 넣지 않는다.
- `.env.app`의 `DATABASE_URL`에만 운영 비밀번호를 입력한다.
- 현재 QNAP DB published port는 `5432` 기준이다.

관련 문서:

- [docs/deploy/01-qnap-container-station.md](./docs/deploy/01-qnap-container-station.md)
- [docs/deploy/03-nas-db-app-host.md](./docs/deploy/03-nas-db-app-host.md)

---

## API 규약

### 공통

#### Base
- Base URL: `/api`
- Content-Type: `application/json; charset=utf-8`

#### Timezone / Format
- Timezone: `Asia/Seoul`
- Date: `YYYY-MM-DD`
- Datetime: ISO8601 with offset (예: `2026-01-27T09:00:00+09:00`)

#### 공통 에러 응답 포맷

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 표시할 메시지"
  }
}
```

### 공통 에러 코드

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_REQUEST` | 요청 형식이 잘못됨 |
| 401 | `UNAUTHORIZED` | 인증 필요 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `NOT_FOUND` | 리소스를 찾을 수 없음 |
| 409 | `RESERVATION_CONFLICT` | 예약 시간 충돌 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

---

## 개발 환경 설정

### 환경 변수 파일 분리

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp .env.docker.example .env.docker
```

### PostgreSQL (Docker)

```bash
docker compose --env-file .env.docker up -d postgres
docker compose --env-file .env.docker ps
```

### Backend

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload --env-file .env --host 0.0.0.0 --port 9191
```

### Frontend

```bash
npm install
npm run dev
```

### Pre-commit Hooks

커밋 전 자동으로 린트/포맷 검사가 실행됩니다.

- **Frontend**: ESLint + Prettier (via lint-staged)
- **Backend**: Ruff + mypy
