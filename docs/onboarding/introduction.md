# 프로젝트 온보딩 가이드

Roombook은 React 프런트엔드와 FastAPI 백엔드로 구성된 회의실 예약/회의록 관리 서비스입니다.  
현재 주요 기능은 회의실 예약, 회의록 작성/잠금, 관리자 사용자 관리, 라벨 관리, AI 전사/회의록 초안 생성입니다.

## 현재 구조

```text
src/
  api/
  components/
  pages/
  stores/

backend/app/
  core/
  infra/
  router/
  service/
```

### 백엔드 레이어 설명

- `router`: HTTP 요청/응답 모델과 인증 체크
- `service`: 유스케이스와 도메인 규칙
- `infra`: DB 세션, SQLAlchemy ORM 모델, 대상별 DB 접근 함수, 외부 API 연동 모듈

현재 `infra`는 `_repo`, `_gateway` suffix를 쓰지 않습니다.

- `user.py`, `reservation.py` 같은 모듈 안에 ORM 모델과 그 대상의 DB 접근 함수가 함께 있다
- `db.py`는 SQLAlchemy `Base`, engine, session provider를 둔다
- `openai.py`는 OpenAI 호출 어댑터를 둔다

## 프런트엔드 개요

- Vite + React + TypeScript
- 주요 화면
  - 로그인
  - 주간/월간 타임테이블
  - 회의록 페이지
  - 관리자 페이지
- 관리자 페이지에서는 사용자 생성/비활성화, 관리자 권한 변경, 라벨 관리, AI 사용량 조회를 제공한다.

## 백엔드 핵심 기능

- 세션 쿠키 기반 로그인
- 회의실 목록 조회
- 주간/월간 타임테이블 조회
- 예약 생성/수정/삭제
- 참석자/외부참석자/라벨/회의록 필드 저장
- 회의록 잠금(`minutes-lock`)과 실시간 상태(`minutes-live-state`)
- AI 전사와 회의록 초안 생성
- 전사 AI 사용량 집계 및 관리자 조회

## 로컬 실행

### Frontend

```bash
npm install
npm run dev
```

기본 주소: `http://localhost:5173`

### Backend

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload --env-file .env
```

## 자주 보는 파일

- 프런트 메인 화면: `src/pages/TimetablePage.tsx`
- 관리자 페이지: `src/pages/AdminPage.tsx`
- 백엔드 진입점: `backend/app/main.py`
- 예약 라우터: `backend/app/router/reservation.py`
- 사용자 서비스: `backend/app/service/user_service.py`
- 예약 서비스: `backend/app/service/reservation_service.py`
- 인프라 예약 모듈: `backend/app/infra/reservation.py`

## 개발 메모

- 운영 배포는 `docs/deploy/` 문서를 기준으로 한다.
- 현재 CORS 허용 오리진은 `http://localhost:5173` 단일 값이다.
- 사용자 삭제는 비활성화 방식이라 테스트/운영 데이터 확인 시 `is_active`를 함께 봐야 한다.
- AI 사용량은 전사 한도와 사용자 누적 사용량을 함께 관리한다.
