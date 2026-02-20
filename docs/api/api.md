# API 명세서

- Revision Date: 2026-02-20
- Version: v1

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
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `RESERVATION_CONFLICT` | 예약 시간 충돌 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

### 권한 정책

- 예약 상세/수정/삭제는 **본인 예약만** 가능하다.
- 타인의 예약에 접근하면 `404 NOT_FOUND`를 반환한다.

---

## 1. 인증 API

### 1.1 POST /auth/login - 로그인

**Request Body**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | Y | 회사 도메인 이메일 |
| password | string | Y | 비밀번호 |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| user | object | `{ id, name, email }` |

**Error**

- `401 UNAUTHORIZED` - 이메일/비밀번호 불일치

---

### 1.2 GET /auth/me - 로그인 사용자 조회

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| user | object | `{ id, name, email }` |

**Error**

- `401 UNAUTHORIZED` - 세션 없음 또는 만료

---

## 2. 타임테이블 API

### 2.1 GET /timetable - 타임테이블 조회

view 파라미터에 따라 주간/월간 데이터를 반환한다.

**공통 Query Parameters**

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| room_id | string | N | `A` | 회의실 ID |
| view | enum | Y | - | `week` \| `month` |

---

### 2.1.1 GET /timetable?view=week - 주간 조회

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
| range | object | `{ start_at, end_at }` |
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

---

### 2.1.2 GET /timetable?view=month - 월간 프리뷰 조회

응답의 `days[]`에는 예약이 존재하는 날짜만 포함된다.

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

---

## 3. 예약 API

### 3.1 POST /reservations - 예약 생성

**Request Body**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| room_id | string | N | 회의실 ID (기본: `A`) |
| title | string | Y | 예약 제목 |
| purpose | string | N | 회의 목적 |
| agenda_url | string | N | 안건/자료 링크 |
| start_at | datetime | Y | 시작 시간 |
| end_at | datetime | Y | 종료 시간 |
| description | string | N | 설명 |
| attendees | string[] | N | 참석자 목록 (`users.id` 또는 `users.email`) |

**Response** `201 Created`

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| room_id | string | 회의실 ID |
| room_name | string | 표시용 회의실 이름 |
| title | string | 제목 |
| purpose | string | 회의 목적 |
| agenda_url | string | 안건/자료 링크 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| created_at | datetime | 생성 시각 |

**Error**

- `400 INVALID_ARGUMENT`
- `401 UNAUTHORIZED`
- `409 RESERVATION_CONFLICT`

---

### 3.2 GET /reservations/{reservation_id} - 예약 상세 조회

**Response** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 예약 ID |
| room_id | string | 회의실 ID |
| room_name | string | 표시용 회의실 이름 |
| title | string | 제목 |
| purpose | string | 회의 목적 |
| agenda_url | string | 안건/자료 링크 |
| start_at | datetime | 시작 시간 |
| end_at | datetime | 종료 시간 |
| description | string | 설명 |
| created_by | object | `{ name }` |
| attendees | array | `[{ id, name, email }]` |

**Error**

- `401 UNAUTHORIZED`
- `404 NOT_FOUND`

---

### 3.3 PATCH /reservations/{reservation_id} - 예약 수정

**Request Body (Partial)**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | N | 제목 |
| purpose | string | N | 회의 목적 |
| agenda_url | string | N | 안건/자료 링크 |
| start_at | datetime | N | 시작 시간 |
| end_at | datetime | N | 종료 시간 |
| description | string | N | 설명 |
| attendees | string[] | N | 참석자 목록 (`users.id` 또는 `users.email`) |

**Response** `200 OK`

- 예약 상세 조회(`3.2`)와 동일 스키마

**Error**

- `400 INVALID_ARGUMENT`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND`
- `409 RESERVATION_CONFLICT`

---

### 3.4 DELETE /reservations/{reservation_id} - 예약 삭제

**Response** `204 No Content`

**Error**

- `401 UNAUTHORIZED`
- `404 NOT_FOUND`

---

## 4. 사용자 검색 API

### 4.1 GET /users/search - 참석자 자동완성

**Query Parameters**

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| q | string | Y | - | 검색어 |
| limit | int | N | 10 | 최대 결과 수(1~20) |

**Response** `200 OK`

```json
[
  {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com"
  }
]
```

**Error**

- `401 UNAUTHORIZED`
