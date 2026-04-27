# Production Rollout Checklist

이 문서는 `QNAP NAS(PostgreSQL) + 사내 PC(frontend/backend)` 운영 환경에서
메인 브랜치 변경사항을 안전하게 반영하는 절차를 정리합니다.

현재 체크포인트는 특히 아래 변경을 포함한 배포를 기준으로 작성했습니다.

- 회의실/회의테이블 변경 기능
- `rooms` 테이블 마이그레이션
- 예약/참석자 UI 변경

## 0. 전제

- NAS PostgreSQL 접속 정보가 준비되어 있어야 합니다.
- 앱 호스트 PC에서 저장소 최신 코드를 받을 수 있어야 합니다.
- 앱 호스트 PC에서 `docker compose`를 사용할 수 있어야 합니다.
- 운영 환경 변수 파일은 `.env.app`을 사용한다고 가정합니다.

## 1. 배포 전 점검

### 1-1. 운영 DB 백업

반드시 먼저 백업합니다.

```bash
pg_dump -h <NAS_IP> -p 5432 -U roombook -d roombook -Fc -f roombook-$(date +%Y%m%d-%H%M).dump
```

복원 테스트까지 가능하면 더 안전합니다.

### 1-2. 기존 room_id 값 확인

이번 구조에서는 `rooms` 테이블에 기본적으로 `A`, `B`가 들어갑니다.
기존 예약 데이터의 `timetables.room_id`에 다른 값이 있으면 먼저 확인해야 합니다.

```sql
SELECT DISTINCT room_id
FROM timetables
ORDER BY 1;
```

확인 기준:

- 결과가 `A`, `B`만 나오면 그대로 진행 가능
- 다른 값이 있으면 해당 ID를 `rooms` 테이블에도 맞춰 넣어야 함

필요 시 예시:

```sql
INSERT INTO rooms (id, name, capacity, updated_at)
VALUES ('C', '추가 회의실', 8, now())
ON CONFLICT (id) DO NOTHING;
```

### 1-3. 운영 DB 현재 마이그레이션 버전 확인

```sql
SELECT * FROM alembic_version;
```

이 값은 반영 전후 확인용으로 기록해 두는 편이 좋습니다.

## 2. 권장 배포 순서

운영에서는 `frontend + backend`를 한 번에 올리기보다 아래 순서를 권장합니다.

1. 메인 브랜치 병합
2. 앱 호스트 PC에서 최신 코드 받기
3. backend 이미지 빌드
4. backend 먼저 기동해서 마이그레이션 성공 확인
5. frontend 기동
6. 브라우저 기능 점검

이 순서가 좋은 이유:

- 마이그레이션 실패를 프론트 영향 없이 먼저 확인할 수 있음
- 세션/프록시 구조는 그대로 두고 앱만 교체 가능
- 문제 발생 시 원인 분리가 쉬움

## 3. 실제 배포 명령

앱 호스트 PC에서 저장소 루트 기준:

### 3-1. 최신 코드 반영

```bash
git pull origin main
```

### 3-2. 이미지 빌드

```bash
docker compose --env-file .env.app -f docker-compose.app.yml build backend frontend
```

### 3-3. backend 먼저 기동

```bash
docker compose --env-file .env.app -f docker-compose.app.yml up -d backend
```

### 3-4. backend 로그 확인

```bash
docker logs -f roombook-backend
```

확인 포인트:

- `uv run alembic upgrade head` 실패가 없어야 함
- 사용자 시드가 중복 없이 `SKIP` 또는 필요한 `ADD`만 출력되어야 함
- 최종적으로 `uvicorn` 실행 로그가 떠야 함

참고:

- backend 시작 시 마이그레이션은 자동 실행됩니다.
- 사용자 시드도 자동 실행되지만, 기존 사용자는 중복 생성하지 않습니다.

## 4. frontend 반영

backend가 정상 확인되면 frontend를 올립니다.

```bash
docker compose --env-file .env.app -f docker-compose.app.yml up -d frontend
```

필요하면 둘 다 상태 확인:

```bash
docker compose --env-file .env.app -f docker-compose.app.yml ps
```

## 5. 배포 후 점검

브라우저에서 아래를 확인합니다.

1. 로그인 가능 여부
2. 대시보드/타임테이블 진입 가능 여부
3. 기존 예약 목록이 정상 표시되는지
4. 예약 상세 열기 가능 여부
5. 예약 수정에서 회의실/회의테이블 변경 가능 여부
6. 새 예약 시 기본 라벨이 `없음`으로 잡히는지
7. 내부/외부 참석자 토큰 입력과 삭제가 정상 동작하는지

## 6. 장애 시 대응

### 6-1. backend 마이그레이션 실패

- frontend는 올리지 말고 backend 로그부터 확인
- 운영 DB 백업본이 있으면 원인 분석 후 복구 가능
- `room_id` 불일치가 원인인지 먼저 확인

### 6-2. frontend만 이상함

- backend API가 정상인지 먼저 확인
- 브라우저 캐시를 비우고 재시도
- frontend 컨테이너만 재기동

```bash
docker compose --env-file .env.app -f docker-compose.app.yml restart frontend
```

### 6-3. 전체 롤백이 필요한 경우

롤백은 데이터 상태에 따라 달라질 수 있으므로 무조건 `alembic downgrade`부터 하지 말고,
백업 복원 전략을 먼저 결정하는 편이 안전합니다.

최소 원칙:

- DB 백업 없이 즉시 downgrade 하지 않기
- 운영 DB 상태와 반영된 migration version 확인 후 판단
- 가능하면 백업본 기반 복원 또는 임시 검증 DB에서 먼저 재현

## 7. 빠른 체크용 요약

```bash
# 1) DB 백업
pg_dump -h <NAS_IP> -p 5432 -U roombook -d roombook -Fc -f roombook-$(date +%Y%m%d-%H%M).dump

# 2) 최신 코드
git pull origin main

# 3) 이미지 빌드
docker compose --env-file .env.app -f docker-compose.app.yml build backend frontend

# 4) backend 먼저 기동
docker compose --env-file .env.app -f docker-compose.app.yml up -d backend
docker logs -f roombook-backend

# 5) frontend 기동
docker compose --env-file .env.app -f docker-compose.app.yml up -d frontend

# 6) 상태 확인
docker compose --env-file .env.app -f docker-compose.app.yml ps
```
