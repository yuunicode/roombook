# Deployment Guide

이 폴더는 로컬 맥북에 있는 이 저장소를 Synology NAS에 배포하는 절차를 단계별로 정리합니다.

## 문서 목록

- [01-synology-nas-manual.md](./01-synology-nas-manual.md)
  - NAS 접속 정보 확인
  - DSM 접속
  - SSH 접속
  - GitLab 저장소 준비
  - NAS에서 `git clone`
  - `docker compose`로 수동 배포
- [02-gitlab-cicd.md](./02-gitlab-cicd.md)
  - GitLab CI/CD로 NAS 자동 배포
  - 필요한 SSH 키와 GitLab 변수
  - `.gitlab-ci.yml` 예시

## 추천 순서

1. 먼저 [01-synology-nas-manual.md](./01-synology-nas-manual.md)대로 수동 배포를 한 번 성공시킵니다.
2. 수동 배포가 안정적으로 동작하면 [02-gitlab-cicd.md](./02-gitlab-cicd.md)로 자동 배포를 붙입니다.

자동 배포를 먼저 붙이면, 어디서 실패하는지 분리하기 어려워집니다. 접속, 권한, Docker, 환경 변수, 레포 clone이 수동으로 검증된 뒤 CI/CD를 붙이는 편이 낫습니다.
