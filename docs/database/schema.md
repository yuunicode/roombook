# Database Schema

## 테이블 상세

### users

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 사용자 고유 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 이메일 (SSO 식별자) |
| name | VARCHAR(100) | NOT NULL | 사용자 이름 |
| department | VARCHAR(100) | | 부서명 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 수정 시각 |

**인덱스:**
- `idx_users_email` - email (로그인 조회용)

---

### rooms

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 회의실 고유 ID |
| name | VARCHAR(100) | UNIQUE, NOT NULL | 회의실 이름 |
| capacity | INTEGER | NOT NULL, CHECK (capacity > 0) | 수용 인원 |
| location | VARCHAR(200) | | 위치 설명 |
| description | TEXT | | 회의실 설명 |
| is_active | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 수정 시각 |

**인덱스:**
- `idx_rooms_is_active` - is_active (활성 회의실 필터링)

---

### reservations

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 예약 고유 ID |
| user_id | UUID | FK -> users(id), NOT NULL | 예약자 ID |
| room_id | UUID | FK -> rooms(id), NOT NULL | 회의실 ID |
| start_time | TIMESTAMP WITH TIME ZONE | NOT NULL | 시작 시간 |
| end_time | TIMESTAMP WITH TIME ZONE | NOT NULL | 종료 시간 |
| title | VARCHAR(200) | NOT NULL | 예약 제목 |
| description | TEXT | | 예약 설명 |
| status | VARCHAR(20) | DEFAULT 'confirmed' | 상태 (confirmed, cancelled) |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성 시각 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 수정 시각 |

**제약조건:**
- `chk_reservation_time` - CHECK (end_time > start_time)
- `fk_reservation_user` - FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- `fk_reservation_room` - FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE

**인덱스:**
- `idx_reservations_room_time` - (room_id, start_time, end_time) - 시간 충돌 검사용
- `idx_reservations_user_id` - user_id - 사용자별 예약 조회용
- `idx_reservations_start_time` - start_time - 날짜별 조회용

---

## 시간 충돌 검사 쿼리 예시

```sql
-- 특정 회의실의 시간 충돌 확인
SELECT EXISTS (
    SELECT 1 FROM reservations
    WHERE room_id = :room_id
      AND status = 'confirmed'
      AND start_time < :end_time
      AND end_time > :start_time
      AND id != :exclude_id  -- 수정 시 자기 자신 제외
);
```
