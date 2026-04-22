# NAS DB + App Host PC

이 문서는 다음 구성을 설명합니다.

- `QNAP NAS`: PostgreSQL만 실행
- `사내 PC`: frontend + backend 실행

현재 운영 기준 NAS DB 상태:

- Container Station container name: `postgres-roombook`
- Published port: `5432`
- 앱 호스트에서는 `NAS_IP:5432`로 접속

현재는 QNAP UI에서 DB 컨테이너를 직접 관리하므로, 저장소 안에는 NAS용 compose/env 파일을 두지 않습니다.

현재 이 프로젝트에서는 이 구성이 가장 안전합니다.

이유:

- 프런트 API base가 상대경로 `/api`로 고정돼 있습니다. [src/api/index.ts](../../src/api/index.ts)
- 프런트 Nginx가 `/api`를 같은 Docker 네트워크의 `backend:8000`으로 프록시합니다. [docker/nginx/default.conf](../../docker/nginx/default.conf)
- 세션 쿠키 기반 인증이라 프런트와 백엔드를 같은 origin으로 두는 편이 단순합니다. [backend/app/core/settings.py](../../backend/app/core/settings.py)

즉, `사용자 브라우저 -> 사내 PC(frontend/nginx) -> backend -> NAS postgres` 구조를 권장합니다.

## 1. QNAP NAS에는 DB만 띄우기

QNAP Container Station에서 직접 생성하거나, 필요하면 예시 compose를 사용합니다.

현재는 이미 `postgres-roombook` 컨테이너가 올라와 있으므로 아래 값만 맞는지 확인하면 됩니다.

- `POSTGRES_DB=roombook`
- `POSTGRES_USER=roombook`
- `POSTGRES_PASSWORD=<운영 비밀번호>`
- `5432 -> 5432/TCP`

주의:

- QNAP 방화벽이나 네트워크 정책에서 `5432`는 앱 호스트 PC에서만 접근 가능하게 제한하는 편이 낫습니다.
- PostgreSQL 데이터는 가능하면 QNAP 볼륨/공유폴더에 영속화하는 편이 낫습니다.

## 2. 사내 PC에는 앱만 띄우기

사내 PC에서:

```bash
cp .env.app.example .env.app
vi .env.app
docker compose --env-file .env.app -f docker-compose.app.yml up -d --build
```

핵심 설정:

- `DATABASE_URL`의 host를 NAS IP 또는 NAS DNS 이름으로 바꿉니다.
- 현재 port는 `5432`를 사용합니다.
- `SESSION_COOKIE_SECURE`
  - 사내망 HTTP면 `false`
  - HTTPS reverse proxy가 있으면 `true`
- `AUTO_SEED_USERS=true`
  - 첫 기동 시 NAS DB로 사용자 시드를 자동 적용합니다.

## 3. 접속 흐름

사용자는 사내 PC의 프런트 주소로만 접속합니다.

예:

- `http://APP_HOST_PC_IP:8080`

프런트 컨테이너의 Nginx가 `/api` 요청을 내부 `backend` 서비스로 넘기므로, 브라우저에서 백엔드 주소를 직접 알 필요가 없습니다.

## 4. 이 구성이 좋은 이유

- DB 볼륨은 NAS에만 남아서 데이터 위치가 명확합니다.
- 앱 서버 PC를 바꾸거나 재설치해도 DB는 유지됩니다.
- 프런트와 백엔드를 같은 호스트에 두므로 CORS/쿠키 이슈를 피할 수 있습니다.
- 현재 코드 수정 없이 바로 맞는 방식입니다.

## 5. 비추천 구조

아래는 현재 코드 기준으로 바로 쓰기 어렵습니다.

- `프런트 PC`와 `백엔드 PC`를 서로 다른 origin으로 분리

이 경우 추가 작업이 필요합니다.

- 프런트 `API_BASE`를 절대 URL 또는 환경변수 기반으로 변경
- 백엔드 CORS 허용 추가
- 세션 쿠키 `SameSite=None`, `Secure=true` 정리
- 프록시/도메인 정책 재설계

원하면 이 구조까지도 바꿔드릴 수 있지만, 지금은 `앱은 한 PC`, `DB만 NAS`가 맞습니다.
