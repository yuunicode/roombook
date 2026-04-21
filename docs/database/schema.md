# Database Schema

- Revision Date: 2026-04-21
- Version: v3

## 개요

현재 백엔드는 SQLAlchemy ORM 모델을 기준으로 아래 테이블을 사용한다.

- `rooms`
- `users`
- `timetables`
- `reservations`
- `reservation_attendees`
- `reservation_labels`
- `minutes_locks`
- `minutes_live_states`
- `user_ai_quotas`
- `global_ai_quotas`

## 테이블 상세

### `rooms`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 회의 공간 ID (`A`, `B`) |
| name | VARCHAR(100) | NOT NULL | 화면 표시 이름 |
| capacity | INTEGER | NOT NULL | 수용 인원 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `users`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 사용자 ID |
| name | VARCHAR(100) | NOT NULL | 사용자 이름 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 로그인 이메일 |
| department | VARCHAR(50) | NOT NULL | 부서명 |
| is_admin | BOOLEAN | NOT NULL, DEFAULT FALSE | 관리자 여부 |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | 활성 사용자 여부 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 해시 비밀번호 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `timetables`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 슬롯 ID |
| room_id | VARCHAR(50) | NOT NULL | 회의실 식별자 |
| start_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 슬롯 시작 시간 |
| end_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 슬롯 종료 시간 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

제약조건

- `uq_timetables_room_time`: UNIQUE (`room_id`, `start_at`, `end_at`)
- `ck_timetables_end_after_start`: CHECK (`end_at > start_at`)

### `reservations`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 예약 ID |
| timetable_id | VARCHAR(50) | FK, UNIQUE, NOT NULL | 연결된 시간 슬롯 |
| user_id | VARCHAR(50) | FK, NOT NULL | 예약 생성자 |
| title | VARCHAR(200) | NOT NULL | 예약 제목 |
| label | VARCHAR(100) | NOT NULL | 회의 라벨 |
| purpose | VARCHAR(500) | NULL | 회의 목적 |
| agenda_url | VARCHAR(1000) | NULL | 관련 링크 |
| description | VARCHAR(1000) | NULL | 예약 설명 |
| external_attendees | VARCHAR(1000) | NULL | 외부 참석자 메모 |
| agenda | VARCHAR(4000) | NULL | 회의 안건 초안 |
| meeting_content | VARCHAR(8000) | NULL | 회의 내용 초안 |
| meeting_result | VARCHAR(8000) | NULL | 회의 결과 초안 |
| minutes_attachment | VARCHAR(1000) | NULL | 회의록 첨부 링크 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 생성 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `reservation_attendees`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| reservation_id | FK | PK, NOT NULL | 예약 ID |
| user_id | FK | PK, NOT NULL | 참석자 사용자 ID |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 등록 시각 |

### `reservation_labels`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| name | VARCHAR(100) | PK, NOT NULL | 라벨명 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `minutes_locks`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| reservation_id | VARCHAR(50) | PK, FK, NOT NULL | 예약 ID |
| holder_user_id | VARCHAR(50) | FK, NOT NULL | 잠금 사용자 ID |
| holder_name | VARCHAR(100) | NOT NULL | 잠금 사용자 표시명 |
| expires_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 잠금 만료 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `minutes_live_states`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| reservation_id | VARCHAR(50) | PK, FK, NOT NULL | 예약 ID |
| transcript_text | TEXT | NOT NULL, DEFAULT '' | 실시간 전사 텍스트 |
| is_recording | BOOLEAN | NOT NULL, DEFAULT FALSE | 녹음 여부 |
| updated_by_user_id | VARCHAR(50) | FK, NULL | 마지막 수정 사용자 ID |
| updated_by_name | VARCHAR(100) | NULL | 마지막 수정 사용자 이름 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `user_ai_quotas`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| user_id | VARCHAR(50) | PK, FK, NOT NULL | 사용자 ID |
| monthly_limit_usd | NUMERIC(10, 4) | NOT NULL, DEFAULT 1.0000 | 사용자 월간 기준 한도 |
| used_usd | NUMERIC(12, 6) | NOT NULL, DEFAULT 0.000000 | 월간 누적 사용량 |
| period_month | VARCHAR(7) | NOT NULL | 기준 월 (`YYYY-MM`) |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

### `global_ai_quotas`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| quota_key | VARCHAR(20) | PK, NOT NULL | 현재는 `global` 단일 키 |
| monthly_limit_usd | NUMERIC(10, 4) | NOT NULL, DEFAULT 5.0000 | 전사 월간 한도 |
| used_usd | NUMERIC(12, 6) | NOT NULL, DEFAULT 0.000000 | 월간 누적 사용량 |
| period_month | VARCHAR(7) | NOT NULL | 기준 월 (`YYYY-MM`) |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

## 데이터 정책 메모

- `room_id`는 현재 FK가 아니라 도메인 키로 사용한다.
- 사용자 삭제는 hard delete가 아니라 `users.is_active=false` 비활성화다.
- AI 사용량은 사용자별 누적 합과 전사 요약이 함께 유지되며, 표시 정밀도는 6자리까지 사용한다.
- `reservation_labels` 삭제 시 예약 라벨 자동 치환은 서비스 계층에서 별도 일괄 처리하지 않는다.
