# Meeting Room Reservation (Django + React)

회의실 예약을 **타임테이블 중심 UI**로 빠르게 처리하는 사내용 웹앱입니다.  
초기 진입 시 기본 회의실 **A**의 타임테이블이 보이고, **주간(그리드)** / **월간(캘린더)** UI를 자유롭게 전환할 수 있습니다.  
인증은 **Hiworks SSO**를 사용하며, 로그인 후에는 우측 상단에 **사용자 이름**이 표시됩니다(로그아웃 기능 없음).

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

### 인증 (Hiworks SSO)
- 우측 상단 [로그인] 클릭 → Hiworks SSO 리다이렉트
- 인증 성공 시 **세션 쿠키(HttpOnly)** 발급
- 이후 사이트 접속 시 [로그인] 대신 **사용자 이름 표시**
- **로그아웃 없음** (세션 만료 또는 브라우저 쿠키 삭제로만 해제)

### 참석자 태그(연동)
- 예약 생성/수정 시 참석자를 **태그/자동완성**으로 선택
- 권장 구조:
  - `GET /users/search?q=...`로 사내 사용자 검색 (백엔드가 Hiworks 디렉터리/조직 데이터를 동기화하거나 프록시)

---

## 기술 스택 (예정)

### Backend
- Django (+ Django REST Framework)
- Session Cookie Auth
- DB: PostgreSQL (권장) 또는 SQLite(초기/PoC)

### Frontend
- React (Vite)
- 주간/월간 캘린더 UI 컴포넌트 구성
- API 통신: fetch/axios (프로젝트 표준에 맞춰 선택)

### Deployment
- Synology NAS: Container Manager(Docker) + Reverse Proxy(HTTPS) 운영 가능

---
