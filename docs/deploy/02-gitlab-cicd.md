# GitLab CI/CD Deployment To Synology NAS

이 문서는 [01-synology-nas-manual.md](./01-synology-nas-manual.md)대로 수동 배포가 이미 성공한 뒤, GitLab CI/CD로 NAS 배포를 자동화하는 방법을 정리합니다.

## 1. 권장 구조

흐름은 아래와 같습니다.

1. 맥북에서 GitLab `main` 브랜치로 push
2. GitLab CI 파이프라인 실행
3. GitLab Runner가 SSH로 NAS 접속
4. NAS에서 최신 코드를 `git pull`
5. `docker compose --env-file .env.nas -f docker-compose.nas.yml up -d --build`

이 구조가 NAS에 webhook 수신 서버를 직접 여는 방식보다 관리가 쉽습니다.

장점:

- NAS에 별도 webhook endpoint를 만들 필요가 없음
- `main` 브랜치만 배포 같은 조건을 CI에서 통제 가능
- 배포 로그를 GitLab에서 바로 확인 가능
- 실패 원인 추적이 쉬움

## 2. 필요한 SSH 키는 2종류입니다

자동 배포에서는 SSH 키가 보통 2세트 필요합니다.

### A. GitLab CI -> NAS 접속용 키

용도:

- GitLab Runner가 NAS에 SSH 접속할 때 사용

등록 위치:

- 개인키: GitLab CI/CD 변수
- 공개키: NAS 사용자 `~/.ssh/authorized_keys`

### B. NAS -> GitLab 저장소 읽기용 키

용도:

- NAS가 private GitLab 저장소를 `git pull` 할 때 사용

등록 위치:

- 개인키: NAS 사용자 `~/.ssh/id_ed25519`
- 공개키: GitLab `SSH Keys` 또는 Deploy Key

둘은 역할이 다르므로 분리하는 편이 운영이 명확합니다.

## 3. GitLab CI가 NAS에 접속할 수 있게 준비

맥북에서 CI 전용 SSH 키를 하나 만듭니다.

```bash
ssh-keygen -t ed25519 -C "gitlab-ci-to-nas"
```

예를 들어 `~/.ssh/gitlab_ci_nas`로 저장했다고 가정합니다.

공개키를 확인합니다.

```bash
cat ~/.ssh/gitlab_ci_nas.pub
```

이 공개키를 NAS 배포 계정의 `authorized_keys`에 추가합니다.

NAS에서:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

`~/.ssh/authorized_keys`에 공개키 한 줄을 추가하고 권한을 맞춥니다.

```bash
chmod 600 ~/.ssh/authorized_keys
```

## 4. GitLab CI/CD 변수 등록

GitLab 프로젝트에서 아래 경로로 들어갑니다.

- `Settings`
- `CI/CD`
- `Variables`

아래 변수를 등록합니다.

- `NAS_HOST`
  - 예: `192.168.0.20`
- `NAS_USER`
  - 예: `deploy`
- `NAS_SSH_PRIVATE_KEY`
  - GitLab CI -> NAS 접속용 개인키 전체 내용
- `REPO_SSH_URL`
  - 예: `git@gitlab.com:<group-or-user>/roombook.git`

권장 설정:

- `NAS_SSH_PRIVATE_KEY`는 `Masked`, `Protected` 처리

## 5. `.gitlab-ci.yml` 예시

프로젝트 루트에 아래 예시를 추가합니다.

```yaml
stages:
  - deploy

deploy_nas:
  stage: deploy
  image: alpine:3.20
  before_script:
    - apk add --no-cache openssh-client git
    - mkdir -p ~/.ssh
    - echo "$NAS_SSH_PRIVATE_KEY" | tr -d '\r' > ~/.ssh/id_ed25519
    - chmod 600 ~/.ssh/id_ed25519
    - ssh-keyscan -H "$NAS_HOST" >> ~/.ssh/known_hosts
  script:
    - |
      ssh "$NAS_USER@$NAS_HOST" "
        set -e
        mkdir -p /volume1/docker
        if [ ! -d /volume1/docker/roombook/.git ]; then
          git clone $REPO_SSH_URL /volume1/docker/roombook
        fi
        cd /volume1/docker/roombook
        git fetch origin
        git checkout main
        git pull origin main
        docker compose --env-file .env.nas -f docker-compose.nas.yml up -d --build
      "
  only:
    - main
```

이 파이프라인은 `main` 브랜치에 push 되었을 때 NAS에서 코드를 갱신하고 배포합니다.

## 6. NAS에서 사전 준비되어 있어야 하는 것

자동 배포 전에 NAS에서 아래가 이미 되어 있어야 합니다.

- SSH 로그인 가능
- `docker compose` 사용 가능
- `/volume1/docker/roombook` 경로 사용 가능
- `.env.nas` 생성 완료
- NAS가 GitLab private 저장소를 읽을 수 있는 SSH 키 등록 완료

이 중 하나라도 빠지면 CI가 실패합니다.

## 7. 실제 배포 절차

1. 로컬 맥북에서 코드를 수정합니다.
2. GitLab `main` 브랜치로 push 합니다.
3. GitLab 파이프라인이 실행됩니다.
4. 성공하면 NAS에서 최신 코드로 컨테이너가 재빌드됩니다.

## 8. 문제 생길 때 먼저 볼 것

### GitLab 파이프라인에서 SSH 접속 실패

확인할 것:

- `NAS_HOST`, `NAS_USER`가 맞는지
- `NAS_SSH_PRIVATE_KEY` 줄바꿈이 깨지지 않았는지
- NAS 사용자 `authorized_keys`에 공개키가 등록되어 있는지

### NAS에서 `git pull` 실패

확인할 것:

- NAS의 GitLab SSH 키가 등록되어 있는지
- `REPO_SSH_URL`이 SSH 주소인지
- NAS에서 `ssh -T git@gitlab.com`이 성공하는지

### `docker compose` 단계 실패

확인할 것:

- `.env.nas`가 존재하는지
- 이미지 빌드에 필요한 네트워크 접근이 가능한지
- NAS 디스크 공간이 충분한지

## 9. 왜 webhook보다 CI/CD를 권장하는가

`push -> webhook -> NAS에서 직접 스크립트 실행`도 가능하지만, NAS에 외부 webhook 수신점을 두어야 하고 인증 검증도 별도로 챙겨야 합니다.

GitLab CI 방식은 아래 이유로 더 낫습니다.

- 로그 확인이 편함
- 브랜치 조건 제어가 쉬움
- 승인, 재실행, 실패 추적이 쉬움
- NAS를 단순 SSH 배포 대상으로 둘 수 있음

## 10. 추천 적용 순서

1. 수동 배포 먼저 성공
2. NAS에서 `git pull`이 되는지 확인
3. CI용 SSH 키 등록
4. GitLab 변수 등록
5. `.gitlab-ci.yml` 추가
6. `main` 브랜치 push로 자동 배포 테스트
