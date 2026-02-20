# Database Schema

- Revision Date: 2026-02-20
- Version: v1

## 테이블 상세

### `users`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 사용자 ID |
| name | VARCHAR(100) | NOT NULL | 사용자 이름 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 로그인 이메일 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 해시 비밀번호 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

**제약조건**
- `users_pkey` - PRIMARY KEY (`id`)
- `users_email_key` - UNIQUE (`email`)

---

### `timetables`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 슬롯 ID |
| room_id | VARCHAR(50) | NOT NULL | 회의실 식별자(도메인 값) |
| start_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 슬롯 시작 시간 |
| end_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 슬롯 종료 시간 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

**제약조건**
- `timetables_pkey` - PRIMARY KEY (`id`)
- `uq_timetables_room_time` - UNIQUE (`room_id`, `start_at`, `end_at`)
- `ck_timetables_end_after_start` - CHECK (`end_at > start_at`)

---

### `reservations`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | VARCHAR(50) | PK, NOT NULL | 예약 ID |
| timetable_id | VARCHAR(50) | FK -> timetables(id), UNIQUE, NOT NULL | 예약 슬롯 |
| user_id | VARCHAR(50) | FK -> users(id), NOT NULL | 예약 생성자 |
| title | VARCHAR(200) | NOT NULL | 예약 제목 |
| purpose | VARCHAR(500) | NULL | 회의 목적 |
| agenda_url | VARCHAR(1000) | NULL | 안건/자료 링크 |
| description | VARCHAR(1000) | NULL | 설명 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 생성 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 수정 시각 |

**제약조건**
- `reservations_pkey` - PRIMARY KEY (`id`)
- `reservations_timetable_id_key` - UNIQUE (`timetable_id`)
- `reservations_timetable_id_fkey` - FOREIGN KEY (`timetable_id`) REFERENCES `timetables(id)` ON DELETE CASCADE
- `reservations_user_id_fkey` - FOREIGN KEY (`user_id`) REFERENCES `users(id)` ON DELETE RESTRICT

---

### `reservation_attendees`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| reservation_id | VARCHAR(50) | PK, FK -> reservations(id), NOT NULL | 예약 ID |
| user_id | VARCHAR(50) | PK, FK -> users(id), NOT NULL | 참석자 사용자 ID |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL | 등록 시각 |

**제약조건**
- `reservation_attendees_pkey` - PRIMARY KEY (`reservation_id`, `user_id`)
- `reservation_attendees_reservation_id_fkey` - FOREIGN KEY (`reservation_id`) REFERENCES `reservations(id)` ON DELETE CASCADE
- `reservation_attendees_user_id_fkey` - FOREIGN KEY (`user_id`) REFERENCES `users(id)` ON DELETE RESTRICT

**인덱스**
- `ix_reservation_attendees_user_id` - (`user_id`)

---

## 데이터 정책 메모

- `room_id`는 현재 FK가 아니라 신뢰 가능한 도메인 식별자다.
- 표시용 회의실 이름(`room_name`)은 API 계층에서 매핑하여 반환한다.
- 초기 관리자 계정은 마이그레이션에서 seed된다. (`admin@ecminer.com`)
