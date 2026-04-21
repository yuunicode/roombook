# API 명세서

- Revision Date: 2026-04-21
- Version: v2

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

### 자주 쓰는 에러 코드

| HTTP | Code | 설명 |
|------|------|------|
| 400 | `INVALID_ARGUMENT` | 요청 값 오류 |
| 400 | `INVALID_PASSWORD` | 현재 비밀번호 오류 |
| 401 | `UNAUTHORIZED` | 로그인 필요 또는 세션 만료 |
| 403 | `FORBIDDEN` | 관리자 권한 또는 잠금 권한 부족 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `RESERVATION_CONFLICT` | 시간대 예약 충돌 |
| 409 | `LOCKED` | 다른 사용자가 회의록 수정 중 |
| 409 | `USER_ALREADY_EXISTS` | 중복 사용자 |
| 409 | `CONFLICT` | 라벨 중복, 관리자 최소 인원 보장 등 충돌 |
| 429 | `QUOTA_EXCEEDED` | 전사 AI 한도 초과 |

### 권한 정책

- `/auth/login`을 제외한 모든 API는 로그인 쿠키가 필요하다.
- 예약 상세/수정/삭제는 현재 예약 생성자만 가능하다.
- 회의록 상세 조회는 로그인 사용자면 가능하지만, 회의록 잠금/실시간 상태 수정은 잠금 소유자 기준으로 제어된다.
- 사용자 생성, 관리자 권한 변경, 사용자 비활성화, 라벨 생성/수정/삭제, AI 사용량 조회는 관리자만 가능하다.

## 1. 인증 API

### `POST /auth/login`

Request body

```json
{
  "email": "admin@ecminer.com",
  "password": "ecminer"
}
```

Response `200 OK`

```json
{
  "user": {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com",
    "is_admin": true
  }
}
```

- 로그인 성공 시 세션 쿠키를 발급한다.

### `GET /auth/me`

Response `200 OK`

```json
{
  "user": {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com",
    "is_admin": true
  }
}
```

### `POST /auth/change-password`

Request body

```json
{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

Response `200 OK`

- 응답 본문은 `/auth/me`와 동일하다.

## 2. 사용자 API

### `GET /users`

로그인 사용자 기준 활성 사용자 목록을 반환한다.

Response `200 OK`

```json
[
  {
    "id": "1",
    "name": "관리자",
    "email": "admin@ecminer.com",
    "department": "운영팀",
    "is_admin": true
  }
]
```

### `GET /users/search`

이름 또는 이메일 기준 사용자 검색.

Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| q | string | Y | - | 검색어, 최소 1자 |
| limit | int | N | 10 | 1 이상 20 이하 |

### `POST /users`

관리자 전용 사용자 생성.

Request body

```json
{
  "id": "consulting_001",
  "name": "권경원",
  "department": "컨설팅"
}
```

- 이메일은 서버에서 `<id>@ecminer.com`으로 생성한다.
- 초기 비밀번호는 서버 기본값 `ecminer`다.

### `PATCH /users/{user_id}/admin`

관리자 권한 부여/해제.

Request body

```json
{
  "is_admin": true
}
```

- 마지막 관리자 1명은 해제할 수 없다.

### `DELETE /users/{user_id}`

관리자 전용 사용자 비활성화.

Response `200 OK`

```json
{
  "ok": true
}
```

- 실제 삭제가 아니라 `is_active=false`, `is_admin=false`로 비활성화한다.
- 본인 계정은 삭제할 수 없다.

### `GET /users/ai-usage`

관리자 전용 AI 사용량 조회.

Response `200 OK`

```json
{
  "summary": {
    "monthly_limit_usd": 5.0,
    "used_usd": 1.0595,
    "remaining_usd": 3.9405,
    "period_month": "2026-04"
  },
  "items": [
    {
      "user_id": "2",
      "name": "일반사용자",
      "email": "user@ecminer.com",
      "department": "개발팀",
      "used_usd": 1.0595,
      "period_month": "2026-04",
      "updated_at": "2026-04-20T10:00:00+09:00"
    }
  ]
}
```

- 전사 한도는 소수점 4자리, 사용량은 소수점 6자리 정밀도를 사용한다.

## 3. 회의실 API

### `GET /rooms`

로그인 사용자가 조회 가능한 회의실 목록.

Response `200 OK`

```json
[
  {
    "id": "A",
    "name": "회의실",
    "capacity": 30
  }
]
```

## 4. 타임테이블 API

### `GET /timetable`

`view` 값에 따라 주간 또는 월간 응답을 반환한다.

공통 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| view | string | Y | - | `week` 또는 `month` |
| room_id | string | N | `A` | 회의실 ID |

### `GET /timetable?view=week`

추가 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| anchor_date | date | Y | - | 기준 날짜 |
| start_at | HH:mm | N | `09:00` | 일일 그리드 시작 시각 |
| end_at | HH:mm | N | `18:00` | 일일 그리드 종료 시각 |

### `GET /timetable?view=month`

추가 Query parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| month | YYYY-MM | Y | - | 조회 월 |
| preview_limit | int | N | 3 | 일자별 미리보기 개수 |

## 5. 예약 API

### `POST /reservations`

Request body

```json
{
  "room_id": "A",
  "title": "주간 회의",
  "label": "AIDA",
  "purpose": "프로젝트 점검",
  "agenda_url": "https://example.com/agenda",
  "start_at": "2026-04-21T10:00:00+09:00",
  "end_at": "2026-04-21T11:00:00+09:00",
  "description": "주간 점검 회의",
  "attendees": ["2", "user@ecminer.com"],
  "external_attendees": "외부 협력사 1명",
  "agenda": "안건 초안",
  "meeting_content": "내용 초안",
  "meeting_result": "결과 초안",
  "minutes_attachment": "https://example.com/file.pdf"
}
```

### `GET /reservations`

회의록 Wiki 목록 조회.

Query parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| recent_months | int | N | 최근 N개월 필터 |
| month | int | N | 시작 월(1-12) |
| day | int | N | 시작 일(1-31) |
| label | string | N | 라벨 필터 |
| creator | string | N | 생성자 이름/이메일 키워드 |
| attendee | string | N | 참석자 이름/이메일 키워드 |

### `GET /reservations/{reservation_id}`

예약 생성자 기준 상세 조회.

### `PATCH /reservations/{reservation_id}`

예약 수정.

- 입력 필드는 생성 API와 동일 구조이며 전부 optional이다.
- 시간 수정 시 충돌 검사와 소유자 검사를 함께 수행한다.

### `DELETE /reservations/{reservation_id}`

예약 삭제.

Response `204 No Content`

## 6. 회의록 API

### `GET /reservations/{reservation_id}/minutes`

회의록 상세 조회.

- 로그인 사용자는 조회 가능하다.
- 응답 구조는 예약 상세와 동일하다.

### `PATCH /reservations/{reservation_id}/minutes`

회의록 필드 수정.

- `title`, `label`, `purpose`, `agenda_url`, `description`, `attendees`, `external_attendees`, `agenda`, `meeting_content`, `meeting_result`, `minutes_attachment`를 사용할 수 있다.
- 일반 예약 수정과 달리 회의록 화면에서 사용하는 업데이트 경로다.

### `GET /reservations/{reservation_id}/minutes-lock`

현재 회의록 잠금 상태 조회.

Response `200 OK` 또는 `null`

### `POST /reservations/{reservation_id}/minutes-lock`

회의록 편집 잠금 획득.

Request body

```json
{
  "ttl_seconds": 15
}
```

### `DELETE /reservations/{reservation_id}/minutes-lock`

잠금 해제.

Response `204 No Content`

### `GET /reservations/{reservation_id}/minutes-live-state`

실시간 회의록 상태 조회.

### `PATCH /reservations/{reservation_id}/minutes-live-state`

실시간 회의록 상태 갱신.

Request body

```json
{
  "transcript_text": "speaker1: ...",
  "is_recording": true
}
```

## 7. 라벨 API

### `GET /labels`

라벨 목록 조회.

### `POST /labels`

관리자 전용 라벨 생성.

### `PATCH /labels/{label_name}`

관리자 전용 라벨명 변경.

### `DELETE /labels/{label_name}`

관리자 전용 라벨 삭제.

- `'없음'` 라벨은 수정/삭제할 수 없다.
- 라벨 자체를 삭제해도 기존 예약 라벨 치환은 현재 서비스 계층에 자동 처리되어 있지 않으므로, 운영 시 삭제 전 사용 현황을 확인해야 한다.

## 8. AI API

### `POST /ai/transcribe-chunk`

오디오 청크 전사.

Request body

```json
{
  "audio_base64": "<base64>",
  "mime_type": "audio/webm",
  "previous_text": "직전 전사 일부"
}
```

Response `200 OK`

```json
{
  "text": "정제된 전사 결과",
  "used_usd": 0.123456,
  "remaining_usd": 4.876544,
  "user_used_usd": 0.023456
}
```

### `POST /ai/suggest-minutes`

전사 텍스트를 기반으로 안건/회의내용/회의결과 초안을 생성한다.

Request body

```json
{
  "transcript": "speaker1: ...",
  "existing_agenda": "",
  "existing_meeting_content": "",
  "existing_meeting_result": ""
}
```

Response `200 OK`

```json
{
  "agenda": ["배포 일정 조정"],
  "meeting_content": ["배포 일정 조정\n이번 주 배포 일정을 다음 주로 조정하기로 논의했다."],
  "meeting_result": ["배포 일정은 다음 주로 재조정한다."],
  "used_usd": 0.100045,
  "remaining_usd": 4.899955,
  "user_used_usd": 0.024501
}
```
