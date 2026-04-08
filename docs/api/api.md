# API 명세서

- Revision Date: 2026-04-08
- Version: v1

## 공통 사항

- Base URL: `/api`
- Content-Type: `application/json; charset=utf-8`
- Timezone: `Asia/Seoul`
- Datetime Format: ISO8601 with offset
- 인증 방식: `ROOMBOOK_SESSION` HttpOnly 쿠키

### 공통 에러 응답

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 표시할 메시지"
  }
}
```

### 공통 에러 코드

| HTTP | Code | 설명 |
|------|------|------|
| 400 | `INVALID_ARGUMENT` | 요청 값 오류 |
| 401 | `UNAUTHORIZED` | 로그인 필요 또는 세션 만료 |
| 403 | `FORBIDDEN` | 관리자 권한 필요 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `RESERVATION_CONFLICT` | 같은 회의실 동일 시간대 예약 충돌 |
| 409 | `LOCKED` | 다른 사용자가 회의록 수정 중 |

### 권한 정책

- `/auth/login`을 제외한 모든 API는 로그인 쿠키가 필요하다.
- 예약 상세/수정/삭제는 현재 백엔드 구현상 예약 생성자만 가능하다.
- 예약 참석자 권한은 아직 백엔드에서 허용하지 않는다.
- 사용자 생성은 관리자 계정만 가능하다.

## 1. 인증 API

### 1.1 `POST /auth/login`

Request body

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | Y | 로그인 이메일 |
| password | string | Y | 비밀번호 |

Response `200 OK`

```json
{
  "user": {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com"
  }
}
```

비고

- 로그인 성공 시 세션 쿠키를 발급한다.
- 서버 시작 시 관리자 계정은 자동 보정된다.

### 1.2 `GET /auth/me`

현재 로그인 사용자를 반환한다.

Response `200 OK`

```json
{
  "user": {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com"
  }
}
```

### 1.3 `POST /auth/change-password`

Request body

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| current_password | string | Y | 현재 비밀번호 |
| new_password | string | Y | 새 비밀번호 |

Response `200 OK`

- 응답 본문은 `/auth/me`와 동일하다.

Error

- `400 INVALID_PASSWORD`
- `401 UNAUTHORIZED`

## 2. 사용자 API

### 2.1 `GET /users/search`

이름 또는 이메일 기준 사용자 검색.

Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| q | string | Y | - | 검색어, 최소 1자 |
| limit | int | N | 10 | 1 이상 20 이하 |

Response `200 OK`

```json
[
  {
    "id": "r&d_001",
    "name": "구지윤",
    "email": "jykoo@ecminer.com"
  }
]
```

### 2.2 `GET /users`

로그인 사용자 기준 전체 사용자 목록.

Response `200 OK`

```json
[
  {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com",
    "department": "운영팀"
  }
]
```

### 2.3 `POST /users`

관리자 전용 사용자 생성.

Request body

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | Y | 사용자 ID |
| name | string | Y | 이름 |
| email | string | Y | 로그인 이메일 |
| department | string | Y | 부서명 |
| password | string | Y | 초기 비밀번호 |

Response `201 Created`

```json
{
  "id": "consulting_001",
  "name": "권경원",
  "email": "kwkwon@ecminer.com",
  "department": "컨설팅"
}
```

Error

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `409 USER_ALREADY_EXISTS`

## 3. 타임테이블 API

### 3.1 `GET /timetable`

`view` 값에 따라 주간 또는 월간 응답을 반환한다.

공통 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| view | string | Y | - | `week` 또는 `month` |
| room_id | string | N | `A` | 회의실 ID |

### 3.1.1 `GET /timetable?view=week`

추가 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| anchor_date | date | Y | - | 기준 날짜 |
| start_at | HH:mm | N | `09:00` | 일일 그리드 시작 시각 |
| end_at | HH:mm | N | `18:00` | 일일 그리드 종료 시각 |

Response `200 OK`

```json
{
  "room": { "id": "A", "name": "Room A" },
  "view": "week",
  "range": {
    "start_at": "2026-04-06T00:00:00+09:00",
    "end_at": "2026-04-12T23:59:59+09:00"
  },
  "grid_config": {
    "day_start": "09:00",
    "day_end": "18:00"
  },
  "reservations": [
    {
      "id": "rsv_xxx",
      "title": "주간 회의",
      "start_at": "2026-04-06T10:00:00+09:00",
      "end_at": "2026-04-06T11:00:00+09:00",
      "created_by": { "name": "관리자" }
    }
  ]
}
```

### 3.1.2 `GET /timetable?view=month`

추가 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| month | YYYY-MM | Y | - | 조회 월 |
| preview_limit | int | N | 3 | 일자별 미리보기 개수 |

Response `200 OK`

```json
{
  "room": { "id": "A", "name": "Room A" },
  "view": "month",
  "month": "2026-04",
  "days": [
    {
      "date": "2026-04-06",
      "total_count": 2,
      "preview": [
        { "id": "rsv_xxx", "start_time": "10:00", "title": "주간 회의" }
      ]
    }
  ]
}
```

## 4. 예약 API

### 4.1 `POST /reservations`

Request body

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| room_id | string | N | 회의실 ID, 기본값 `A` |
| title | string | Y | 예약 제목 |
| label | string | N | 예약 라벨 |
| purpose | string | N | 회의 목적 |
| agenda_url | string | N | 첨부 링크 |
| start_at | datetime | Y | 시작 시각 |
| end_at | datetime | Y | 종료 시각 |
| description | string | N | 메모 |
| attendees | string[] | N | 사용자 ID 또는 이메일 배열 |
| external_attendees | string | N | 외부 참석자 |
| agenda | string | N | 주요 안건 |
| meeting_content | string | N | 회의 내용 |
| meeting_result | string | N | 회의 결과 |
| minutes_attachment | string | N | 회의록 첨부 링크/경로 |

Response `201 Created`

```json
{
  "id": "rsv_xxx",
  "room_id": "A",
  "room_name": "Room A",
  "title": "주간 회의",
  "label": "AIDA",
  "purpose": "현황 공유",
  "agenda_url": "https://example.com/doc",
  "start_at": "2026-04-06T10:00:00+09:00",
  "end_at": "2026-04-06T11:00:00+09:00",
  "created_at": "2026-04-06T09:55:00+09:00"
}
```

### 4.2 `GET /reservations/{reservation_id}`

Response `200 OK`

```json
{
  "id": "rsv_xxx",
  "room_id": "A",
  "room_name": "Room A",
  "title": "주간 회의",
  "label": "AIDA",
  "purpose": "현황 공유",
  "agenda_url": "https://example.com/doc",
  "start_at": "2026-04-06T10:00:00+09:00",
  "end_at": "2026-04-06T11:00:00+09:00",
  "description": "회의 메모",
  "external_attendees": "외부 파트너 1",
  "agenda": "주요 안건 텍스트",
  "meeting_content": "회의 내용 텍스트",
  "meeting_result": "회의 결과 텍스트",
  "minutes_attachment": "https://example.com/minutes",
  "created_by": { "name": "관리자" },
  "attendees": [
    {
      "id": "r&d_001",
      "name": "구지윤",
      "email": "jykoo@ecminer.com"
    }
  ]
}
```

### 4.3 `PATCH /reservations/{reservation_id}`

부분 수정 API.

허용 필드

- `title`
- `label`
- `purpose`
- `agenda_url`
- `start_at`
- `end_at`
- `description`
- `attendees`
- `external_attendees`
- `agenda`
- `meeting_content`
- `meeting_result`
- `minutes_attachment`

Response `200 OK`

- 응답 본문은 예약 상세 조회와 동일하다.

### 4.4 `DELETE /reservations/{reservation_id}`

Response `204 No Content`

### 4.5 `GET /reservations`

회의록 Wiki 목록 조회. 전체 예약을 대상으로 필터링 가능.

Query parameters (모두 Optional)

| 이름 | 타입 | 설명 |
|------|------|------|
| recent_months | int | 최근 N개월 |
| month | int | 월(1~12) |
| day | int | 일(1~31) |
| label | string | 라벨 |
| creator | string | 예약자(이름/이메일) 키워드 |
| attendee | string | 참석자(내부/외부) 키워드 |

Response `200 OK`

- 응답 스키마는 `GET /reservations/{reservation_id}`와 동일한 객체 배열

### 4.6 `GET /reservations/{reservation_id}/minutes`

회의록 상세 조회(예약 생성자 제한 없이 로그인 사용자면 조회 가능).

### 4.7 `PATCH /reservations/{reservation_id}/minutes`

회의록 상세 수정(제목/라벨/시간/참석자/회의록 필드 포함).

### 4.8 `GET /reservations/{reservation_id}/minutes-lock`

현재 회의록 수정 잠금 조회.

Response `200 OK` (잠금 있음)

```json
{
  "reservation_id": "rsv_xxx",
  "holder_user_id": "1",
  "holder_name": "관리자",
  "expires_at": "2026-04-08T12:01:30+00:00"
}
```

Response `200 OK` (잠금 없음)

```json
null
```

### 4.9 `POST /reservations/{reservation_id}/minutes-lock`

회의록 수정 잠금 획득/갱신.

Request body

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| ttl_seconds | int | N | 15 | 잠금 유지 시간(5~120초) |

### 4.10 `DELETE /reservations/{reservation_id}/minutes-lock`

회의록 수정 잠금 해제.
