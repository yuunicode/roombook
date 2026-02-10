# API 명세서

## 공통 사항

- **Base URL**: `/api`
- **Content-Type**: `application/json; charset=utf-8`
- **Timezone**: `Asia/Seoul`
- **Datetime Format**: ISO8601 with offset (예: `2026-01-27T09:00:00+09:00`)

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
| 400 | `INVALID_ARGUMENT` | 요청 형식 오류 |
| 401 | `UNAUTHORIZED` | 인증 필요 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `RESERVATION_CONFLICT` | 예약 시간 충돌 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 1. 인증 API

인증은 관리자 사전 등록 `users` 테이블 기반으로 동작한다.
사용자는 `회사 도메인 이메일 + 비밀번호(ecminer)`로 로그인한다.
로그인 성공 시 쿠키 세션은 1년간 유지된다.

### 1.1 POST /auth/login - 로그인

**Request Body**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | Y | 회사 도메인 이메일 |
| password | string | Y | 비밀번호 (`ecminer`) |

**Example Request**

```json
{
  "email": "admin@ecminer.com",
  "password": "ecminer"
}
```

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| user | object | `{ id, name, email }` |

**Set-Cookie**

- `ROOMBOOK_SESSION=...; HttpOnly; Max-Age=31536000; Path=/`

**Error**

- `401 UNAUTHORIZED` - 이메일/비밀번호 불일치

---

### 1.2 GET /auth/me - 로그인 사용자 조회

쿠키 세션 기준으로 현재 로그인 사용자를 조회한다.

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| user | object | `{ id, name, email }` |

**Error**

- `401 UNAUTHORIZED` - 세션 없음 또는 만료

---

## 2. 타임테이블 API

### 2.1 GET /timetable - 타임테이블 조회

view 파라미터에 따라 주간 그리드 또는 월간 프리뷰 데이터를 반환한다.

**공통 Query Parameters**

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| room_id | string | N | `A` | 회의실 ID |
| view | enum | Y | - | `week` \| `month` |

---

### 2.1.1 GET /timetable?view=week - 주간 그리드 조회

**추가 Query Parameters**

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| anchor_date | date | Y | - | 기준 날짜 (해당 주 반환) |
| start_at | HH:mm | N | 09:00 | 그리드 시작 시간 |
| end_at | HH:mm | N | 18:00 | 그리드 종료 시간 |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| room | object | `{ id, name }` |
| view | string | `week` |
| range | object | `{ start_at, end_at }` - 주 범위 |
| grid_config | object | `{ day_start, day_end }` |
| reservations[] | array | 예약 목록 |

**reservations[] item**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| title | string | 제목 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| created_by | object | `{ name }` |

**Example**

```json
{
  "room": { "id": "A", "name": "회의실A" },
  "view": "week",
  "range": {
    "start_at": "2026-01-26T00:00:00+09:00",
    "end_at": "2026-02-02T00:00:00+09:00"
  },
  "grid_config": { "day_start": "09:00", "day_end": "18:00" },
  "reservations": [
    {
      "id": "rsv_101",
      "title": "주간 회의",
      "start_at": "2026-01-27T10:00:00+09:00",
      "end_at": "2026-01-27T11:00:00+09:00",
      "created_by": { "name": "홍길동" }
    }
  ]
}
```

---

### 2.1.2 GET /timetable?view=month - 월간 프리뷰 조회

월간 캘린더의 각 날짜 셀에 표시할 예약 요약을 반환한다.

**추가 Query Parameters**

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| month | YYYY-MM | Y | - | 조회 월 |
| preview_limit | int | N | 3 | 날짜 셀에 보여줄 예약 수 |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| room | object | `{ id, name }` |
| view | string | `month` |
| month | string | YYYY-MM |
| days[] | array | 날짜별 프리뷰 |

**days[] item**

| 필드 | 타입 | 설명 |
|------|------|------|
| date | date | 날짜 |
| total_count | int | 해당일 총 예약 수 |
| preview[] | array | 상위 N개 예약 |

**preview[] item**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| start_time | HH:mm | 시작 시간 |
| title | string | 제목 |

**Example**

```json
{
  "room": { "id": "A", "name": "회의실A" },
  "view": "month",
  "month": "2026-01",
  "days": [
    {
      "date": "2026-01-10",
      "total_count": 4,
      "preview": [
        { "id": "rsv_1", "start_time": "14:00", "title": "정기회의" },
        { "id": "rsv_2", "start_time": "15:00", "title": "설비점검" },
        { "id": "rsv_3", "start_time": "16:30", "title": "인터뷰" }
      ]
    }
  ]
}
```

---

## 3. 예약 API

### 3.1 POST /reservations - 예약 생성

**Request Body**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| room_id | string | N | 회의실 ID (기본: `A`) |
| title | string | Y | 예약 제목 |
| start_at | datetime | Y | 시작 시간 |
| end_at | datetime | Y | 종료 시간 |
| description | string | N | 설명 |
| attendees | string[] | N | 참석자 목록 |

**Example Request**

```json
{
  "room_id": "A",
  "title": "프로젝트 킥오프",
  "start_at": "2026-01-27T13:00:00+09:00",
  "end_at": "2026-01-27T14:00:00+09:00",
  "description": "회의 안건..."
}
```

**Response** `201 Created`

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| room_id | string | 회의실 ID |
| title | string | 제목 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| created_at | datetime | 생성 시각 |

**Error**

- `400 INVALID_ARGUMENT` - 종료시간 ≤ 시작시간, 포맷 오류
- `409 RESERVATION_CONFLICT` - 겹치는 예약 존재

---

### 3.2 GET /reservations/{reservation_id} - 예약 상세 조회

**Path Parameters**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| reservation_id | string | Y | 예약 ID |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| room_id | string | 회의실 ID |
| title | string | 제목 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| description | string | 설명 |
| created_by | object | `{ name }` - 생성자 |

**Error**

- `404 NOT_FOUND`

---

### 3.3 PATCH /reservations/{reservation_id} - 예약 수정

**Path Parameters**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| reservation_id | string | Y | 예약 ID |

**Request Body** (Partial)

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | N | 제목 |
| start_at | datetime | N | 시작 시간 |
| end_at | datetime | N | 종료 시간 |
| description | string | N | 설명 |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| room_id | string | 회의실 ID |
| title | string | 제목 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| description | string | 설명 |
| created_by | object | `{ name }` |

**Error**

- `400 INVALID_ARGUMENT`
- `404 NOT_FOUND`
- `409 RESERVATION_CONFLICT`

---

### 3.4 DELETE /reservations/{reservation_id} - 예약 삭제

**Path Parameters**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| reservation_id | string | Y | 예약 ID |

**Response** `204 No Content`

**Error**

- `404 NOT_FOUND`
