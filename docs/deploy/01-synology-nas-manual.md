# Synology NAS Manual Deployment

이 문서는 로컬 맥북에 있는 이 프로젝트를 Synology NAS로 옮겨서 배포하는 가장 현실적인 순서를 정리합니다.

대상 독자:

- NAS 접속 주소를 아직 모름
- 관리자 권한은 받았지만 DSM, SSH, Docker 사용 방법이 익숙하지 않음
- GitLab으로 코드를 관리하고 싶음
- 일단 수동 배포를 먼저 성공시키고 싶음

## 1. 먼저 받아야 하는 정보

배포 전에 아래 정보가 필요합니다.

- NAS 주소
  - 예: `192.168.0.20`
  - 또는 사내 DNS 이름
- DSM 로그인 계정과 비밀번호
- SSH 접속 가능 여부
- 배포할 공유 폴더 경로
  - 보통 `/volume1/docker`
- Synology `Container Manager` 설치 여부

관리자에게는 아래처럼 요청하면 됩니다.

```text
DSM 접속 주소, 제 계정, SSH 접속 가능 여부, Container Manager 사용 가능 여부, 배포용 공유 폴더 경로를 알려주세요.
```

## 2. 맥북에서 DSM 접속 확인

사내망에 있어야 하므로 회사 Wi-Fi 또는 VPN 연결 상태를 먼저 확인합니다.

브라우저에서 아래 주소로 접속합니다.

- `http://NAS_IP:5000`
- `https://NAS_IP:5001`

예시:

- `http://192.168.0.20:5000`
- `https://192.168.0.20:5001`

DSM 로그인 화면이 뜨면 웹 관리 접속은 성공입니다.

접속이 안 되면 아래를 확인합니다.

- 사내망 또는 VPN 연결 여부
- NAS IP 또는 도메인이 맞는지
- DSM 포트 `5000`, `5001`이 열려 있는지

## 3. SSH 접속 확인

맥북 터미널에서 아래처럼 접속합니다.

```bash
ssh <계정>@<NAS_IP>
```

예시:

```bash
ssh kuku@192.168.0.20
```

처음 접속이면 아래 같은 메시지가 나올 수 있습니다.

```text
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

`yes`를 입력하면 됩니다.

### SSH 접속이 안 될 때

`Connection refused`가 뜨면 NAS에서 SSH 서비스가 꺼져 있을 가능성이 큽니다.

DSM에서 보통 아래 경로에서 켭니다.

- `제어판`
- `터미널 및 SNMP`
- `SSH 서비스 활성화`

권한이 부족하면 관리자에게 켜 달라고 요청해야 합니다.

## 4. NAS에서 Docker 사용 가능 여부 확인

SSH로 NAS에 접속한 뒤 아래 명령을 실행합니다.

```bash
docker --version
docker compose version
```

둘 중 하나라도 안 되면 DSM의 `패키지 센터`에서 `Container Manager` 설치 여부를 확인해야 합니다.

이 프로젝트는 NAS용 Compose 파일인 [`docker-compose.nas.yml`](../../docker-compose.nas.yml)을 사용합니다.

구성은 아래 3개 컨테이너입니다.

- `frontend`
- `backend`
- `postgres`

## 5. NAS에 배포 폴더 준비

SSH 접속 상태에서 아래처럼 폴더를 만듭니다.

```bash
mkdir -p /volume1/docker
cd /volume1/docker
```

이 문서에서는 배포 경로를 `/volume1/docker/roombook`으로 가정합니다.

## 6. GitLab에 저장소 준비

이 프로젝트가 아직 로컬 맥북에만 있다면, 먼저 GitLab에 올려야 NAS에서 `git clone` 할 수 있습니다.

GitLab 웹에서 새 프로젝트를 만듭니다.

- 빈 프로젝트 생성
- 예시 이름: `roombook`

그다음 맥북에서 저장소 원격을 설정합니다.

현재 이 저장소의 기존 원격이 다른 곳을 가리키고 있다면, GitLab 원격을 새로 추가해도 됩니다.

```bash
cd /Users/kuku/Projects/roombook
git remote -v
git remote add gitlab git@gitlab.com:<group-or-user>/roombook.git
```

처음 push 할 때:

```bash
git branch -M main
git add .
git commit -m "Initial commit"
git push -u gitlab main
```

이미 커밋이 있다면 보통 아래만 실행하면 됩니다.

```bash
git push -u gitlab main
```

## 7. NAS가 GitLab 저장소를 읽을 수 있게 SSH 키 등록

NAS가 private GitLab 저장소를 clone 하려면 NAS 자신의 SSH 키를 GitLab에 등록해야 합니다.

NAS SSH 세션에서:

```bash
ssh-keygen -t ed25519 -C "nas-deploy"
```

기본 경로로 생성하면 보통 `~/.ssh/id_ed25519`와 `~/.ssh/id_ed25519.pub`가 만들어집니다.

공개키를 확인합니다.

```bash
cat ~/.ssh/id_ed25519.pub
```

출력된 내용을 GitLab에 등록합니다.

- GitLab
- `User Settings`
- `SSH Keys`
- 공개키 붙여넣기

등록 후 NAS에서 접속 테스트:

```bash
ssh -T git@gitlab.com
```

## 8. NAS에서 프로젝트 clone

NAS SSH 세션에서:

```bash
cd /volume1/docker
git clone git@gitlab.com:<group-or-user>/roombook.git
cd roombook
```

이제 로컬 맥북이 아니라 NAS 내부에 실제 배포 대상 코드가 생깁니다.

## 9. 운영 환경 변수 파일 준비

이 저장소에는 NAS용 예시 파일 [`.env.nas.example`](../../.env.nas.example)가 있습니다.

NAS에서 아래처럼 복사합니다.

```bash
cp .env.nas.example .env.nas
```

최소한 아래 값은 반드시 바꿉니다.

- `POSTGRES_PASSWORD`
- `SESSION_SIGNING_SECRET`
- `FRONTEND_PORT`
- `OPENAI_API_KEY`
  - 사용하지 않으면 비워둘 수 있음

예시:

```env
FRONTEND_PORT=8080
POSTGRES_DB=roombook
POSTGRES_USER=roombook
POSTGRES_PASSWORD=change-this-to-a-strong-password
HOST=0.0.0.0
PORT=8000
DEBUG=false
DATABASE_URL=postgresql+asyncpg://roombook:change-this-to-a-strong-password@postgres:5432/roombook
SESSION_SIGNING_SECRET=replace-with-a-long-random-secret
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
OPENAI_API_KEY=
```

랜덤 시크릿은 아래처럼 만들 수 있습니다.

```bash
openssl rand -hex 32
```

`.env.nas`는 Git에 커밋하지 않습니다.

## 10. NAS에서 수동 배포 실행

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
docker compose --env-file .env.nas -f docker-compose.nas.yml up -d --build
```

이 명령은 아래 작업을 수행합니다.

- `postgres` 컨테이너 실행
- `backend` 이미지 빌드 및 실행
- `frontend` 이미지 빌드 및 실행

이 저장소의 Nginx 설정은 `/api`를 백엔드로 프록시하도록 되어 있으므로, 브라우저는 프런트엔드만 바라보면 됩니다.

관련 파일:

- [`docker-compose.nas.yml`](../../docker-compose.nas.yml)
- [`Dockerfile.frontend`](../../Dockerfile.frontend)
- [`backend/Dockerfile`](../../backend/Dockerfile)
- [`docker/nginx/default.conf`](../../docker/nginx/default.conf)

## 11. 배포 상태 확인

```bash
docker compose --env-file .env.nas -f docker-compose.nas.yml ps
docker compose --env-file .env.nas -f docker-compose.nas.yml logs -f backend
```

브라우저에서는 아래처럼 접속합니다.

```text
http://NAS_IP:8080
```

예시:

```text
http://192.168.0.20:8080
```

`.env.nas`에서 `FRONTEND_PORT`를 바꿨다면 그 포트로 접속하면 됩니다.

## 12. 코드 수정 후 재배포

맥북에서 코드를 수정하고 GitLab에 push 한 뒤, NAS에서 아래 명령으로 갱신합니다.

```bash
cd /volume1/docker/roombook
git pull
docker compose --env-file .env.nas -f docker-compose.nas.yml up -d --build
```

이 단계까지가 수동 배포입니다.

## 13. Reverse Proxy 권장 구조

운영에서는 Synology Reverse Proxy를 두고 외부에는 HTTPS만 공개하는 편이 낫습니다.

권장 방식:

- 외부: `443`
- 내부 대상: `http://NAS_IP:FRONTEND_PORT`

즉, NAS의 Reverse Proxy는 `frontend` 컨테이너만 바라보게 두고 `backend`, `postgres`는 직접 외부에 공개하지 않습니다.

## 14. 현재 프로젝트 기준 운영 메모

현재 백엔드에는 개발용 CORS 설정이 들어 있습니다.

- [`backend/app/main.py`](../../backend/app/main.py)

다만 현재 NAS 배포 구조는 프런트엔드 Nginx가 같은 오리진에서 `/api`를 백엔드로 프록시하므로, 프런트와 백엔드를 별도 도메인이나 포트로 나누지 않는 한 운영 시 큰 문제는 없습니다.

반대로 프런트와 백엔드를 서로 다른 주소로 직접 노출할 계획이면 아래를 별도로 손봐야 합니다.

- 운영 도메인 기준 CORS 허용 오리진
- 쿠키 `SameSite` 정책
- HTTPS 강제
- 프록시 헤더 처리

## 15. 수동 배포가 먼저인 이유

GitLab CI/CD를 먼저 붙이면 실패 지점이 섞입니다.

- GitLab 인증 문제
- NAS SSH 문제
- Docker 문제
- 환경 변수 문제
- 레포 clone 문제

그래서 아래 순서가 가장 낫습니다.

1. DSM 접속 성공
2. SSH 접속 성공
3. NAS에서 `docker compose` 실행 성공
4. 브라우저 접속 성공
5. 그 다음 GitLab CI/CD 추가
