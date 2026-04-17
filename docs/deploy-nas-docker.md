# NAS Docker Deployment

이 문서는 Synology NAS 기준으로 `frontend + backend + postgres`를 Docker Compose로 배포하는 운영 절차를 정리합니다.

## 구조

- `frontend`: Vite 빌드 결과를 Nginx가 서빙하고 `/api`를 백엔드로 프록시합니다.
- `backend`: FastAPI + Alembic 마이그레이션을 실행한 뒤 `uvicorn`으로 구동합니다.
- `postgres`: 내부 네트워크에서만 접근 가능한 PostgreSQL입니다.

이 구성을 쓰면 브라우저는 하나의 오리진만 보게 되므로 쿠키 기반 인증 운영이 단순해집니다.

## 1. 운영 환경 변수 준비

```bash
cp .env.nas.example .env.nas
```

운영 시 반드시 아래 값을 바꾸세요.

- `POSTGRES_PASSWORD`
- `SESSION_SIGNING_SECRET`
- `OPENAI_API_KEY` 사용 시 실제 키
- `FRONTEND_PORT` 필요 시 NAS 포트에 맞게 조정

`SESSION_SIGNING_SECRET`는 최소 32바이트 이상 랜덤 문자열을 권장합니다.

예시:

```bash
openssl rand -hex 32
```

## 2. 컨테이너 실행

```bash
docker compose --env-file .env.nas -f docker-compose.nas.yml up -d --build
```

상태 확인:

```bash
docker compose --env-file .env.nas -f docker-compose.nas.yml ps
docker compose --env-file .env.nas -f docker-compose.nas.yml logs -f backend
```

## 3. Synology Reverse Proxy

권장 방식:

- 외부 `443` HTTPS
- 내부 대상 `http://NAS_IP:FRONTEND_PORT`

즉, NAS 리버스 프록시는 `frontend` 컨테이너만 바라보게 두고, 백엔드와 DB는 외부에 노출하지 않습니다.

## 4. 보안 체크리스트

- `SESSION_COOKIE_SECURE=true` 유지
- HTTPS만 외부 공개
- `postgres` 포트 외부 미노출
- `.env.nas`를 Git에 커밋하지 않기
- NAS 방화벽에서 필요한 포트만 허용
- 관리자 계정과 DB 비밀번호를 개발용 기본값으로 두지 않기
- 이미지 업데이트 시 `docker compose pull` 또는 재빌드로 보안 패치 반영
- 백업 대상에 Postgres 볼륨 포함

## 5. 운영 메모

현재 백엔드는 개발용 CORS 설정(`http://localhost:5173`)이 코드에 들어 있습니다. 이 Docker 배포 방식은 프런트가 `/api`를 같은 오리진으로 프록시하므로 운영 시 CORS 이슈가 거의 없습니다.

반대로 프런트와 백엔드를 서로 다른 도메인이나 포트로 직접 노출할 경우에는 다음을 추가로 정리해야 합니다.

- 운영 도메인을 반영한 CORS 허용 오리진
- 쿠키 `SameSite=None` 필요 여부 검토
- HTTPS 강제 및 프록시 헤더 정리
