# Deployment Guide

이 폴더는 현재 `QNAP NAS + 사내 PC 앱 호스트` 기준 배포 절차를 정리합니다.

## 문서 목록

- [01-qnap-container-station.md](./01-qnap-container-station.md)
  - QNAP Container Station DB 컨테이너 확인
  - 현재 NAS DB 컨테이너 기준값 정리
  - 앱 호스트 PC 환경 변수 연결
- [03-nas-db-app-host.md](./03-nas-db-app-host.md)
  - NAS에는 PostgreSQL만 유지
  - 다른 사내 PC에 frontend + backend 호스팅
  - NAS DB를 외부 앱 호스트에서 사용하는 설정

## 추천 순서

1. 먼저 [01-qnap-container-station.md](./01-qnap-container-station.md)에서 QNAP DB 컨테이너 설정을 확인합니다.
2. 그다음 [03-nas-db-app-host.md](./03-nas-db-app-host.md)대로 사내 PC에 앱을 띄웁니다.

배포는 먼저 수동으로 검증하는 편이 낫습니다. QNAP DB 접근, 환경 변수, Docker 실행이 먼저 확인되어야 이후 운영이 단순해집니다.
