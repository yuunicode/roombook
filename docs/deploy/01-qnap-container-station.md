# QNAP Container Station Deployment

이 문서는 현재 운영 기준 배포 구성을 정리합니다.

- `QNAP NAS`: PostgreSQL만 실행
- `다른 사내 PC`: frontend + backend 실행

현재 확인된 NAS DB 컨테이너 상태:

- Container name: `postgres-roombook`
- Image: `postgres:16`
- Published port: `5432`

주의:

- 위 컨테이너 이름은 QNAP 내부 식별용입니다.
- 앱 호스트 PC에서는 `NAS_IP:5432`로 접속합니다.
- 운영 비밀번호는 저장소에 기록하지 않습니다.

## 1. QNAP NAS에서 확인할 것

Container Station에서 아래 항목이 맞는지 확인합니다.

- Image: `postgres:16`
- Container name: `postgres-roombook`
- Port publish: `5432 -> 5432/TCP`
- Environment
  - `POSTGRES_DB=roombook`
  - `POSTGRES_USER=roombook`
  - `POSTGRES_PASSWORD=<운영 비밀번호>`
- Volume
  - 가능하면 NAS 폴더를 `/var/lib/postgresql/data`에 연결

현재 운영 흐름에서는 NAS에 앱 소스코드나 frontend/backend 컨테이너를 둘 필요가 없습니다.

## 2. 앱 호스트 PC에서 사용할 값

앱 호스트 PC에서는 [`.env.app.example`](../../.env.app.example)를 복사해 `.env.app`을 만듭니다.

핵심 값:

```env
DATABASE_URL=postgresql+asyncpg://roombook:<QNAP에 설정한 비밀번호>@<NAS_IP>:5432/roombook
SESSION_SIGNING_SECRET=<랜덤 긴 문자열>
SESSION_COOKIE_SECURE=false
AUTO_SEED_USERS=true
```

설명:

- `DATABASE_URL`의 host는 QNAP NAS IP
- port는 현재 QNAP에서 publish한 `5432`
- 비밀번호는 QNAP Postgres 컨테이너에 넣은 값과 동일해야 함
- `AUTO_SEED_USERS=true`면 backend 시작 시 마이그레이션 후 사용자 시드 자동 실행

## 3. 앱 호스트 PC에서 실행

사내 PC에 이 저장소를 둔 뒤:

```bash
cp .env.app.example .env.app
vi .env.app
docker compose --env-file .env.app -f docker-compose.app.yml up -d --build
```

실행 시 backend가 아래를 자동 수행합니다.

1. `alembic upgrade head`
2. `seed_users.py` 실행

즉, 사용자 시드는 앱 호스트 PC의 backend가 QNAP DB에 직접 넣습니다.

## 4. 접속 구조

실제 요청 흐름은 아래입니다.

`브라우저 -> 사내 PC(frontend/nginx) -> backend -> QNAP postgres`

프런트는 `/api` 상대경로를 쓰고, nginx가 내부 `backend:9191`으로 프록시합니다.
그래서 frontend와 backend는 같은 PC에 두는 편이 가장 단순합니다.

## 5. 현재 기준 참고 문서

- [README.md](../../README.md)
- [03-nas-db-app-host.md](./03-nas-db-app-host.md)
