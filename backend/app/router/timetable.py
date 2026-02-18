from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.infra.reservation import Reservation
from app.infra.timetable import Timetable
from app.infra.user import User
from app.infra.user_schema import AuthUserModel
from app.service.auth_service import get_user_from_session_token

router = APIRouter(prefix="/api/timetable", tags=["timetable"])
KST = ZoneInfo("Asia/Seoul")


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class RoomResponse(BaseModel):
    id: str
    name: str


class RangeResponse(BaseModel):
    start_at: datetime
    end_at: datetime


class GridConfigResponse(BaseModel):
    day_start: str
    day_end: str


class CreatedByResponse(BaseModel):
    name: str


class WeekReservationItem(BaseModel):
    id: str
    title: str
    start_at: datetime
    end_at: datetime
    created_by: CreatedByResponse


class WeekTimetableResponse(BaseModel):
    room: RoomResponse
    view: str
    range: RangeResponse
    grid_config: GridConfigResponse
    reservations: list[WeekReservationItem]


class MonthPreviewItem(BaseModel):
    id: str
    start_time: str
    title: str


class MonthDayItem(BaseModel):
    date: date
    total_count: int
    preview: list[MonthPreviewItem]


class MonthTimetableResponse(BaseModel):
    room: RoomResponse
    view: str
    month: str
    days: list[MonthDayItem]


@router.get(
    "",
    response_model=WeekTimetableResponse | MonthTimetableResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_timetable(
    request: Request,
    view: str = Query(..., pattern="^(week|month)$"),
    room_id: str = Query("A"),
    anchor_date: date | None = Query(None),
    start_at: str = Query("09:00"),
    end_at: str = Query("18:00"),
    month: str | None = Query(None),
    preview_limit: int = Query(3, ge=1, le=20),
    db: AsyncSession = Depends(get_db_session),
) -> WeekTimetableResponse | MonthTimetableResponse | JSONResponse:
    auth_user = _require_auth_user(request)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    if view == "week":
        if anchor_date is None:
            return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "anchor_date는 필수입니다.")
        day_start = _parse_hhmm(start_at)
        day_end = _parse_hhmm(end_at)
        if day_start is None or day_end is None or day_end <= day_start:
            return _error_response(
                status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "start_at/end_at 형식이 올바르지 않습니다."
            )
        return await _get_week_timetable(db, room_id, anchor_date, start_at, end_at)

    if month is None:
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "month는 필수입니다.")
    parsed_month = _parse_month(month)
    if parsed_month is None:
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "month 형식은 YYYY-MM 이어야 합니다.")
    return await _get_month_timetable(db, room_id, parsed_month, preview_limit)


async def _get_week_timetable(
    db: AsyncSession,
    room_id: str,
    anchor_date: date,
    day_start: str,
    day_end: str,
) -> WeekTimetableResponse:
    week_start_date = anchor_date - timedelta(days=anchor_date.weekday())
    week_start = datetime.combine(week_start_date, time(0, 0), tzinfo=KST)
    week_end = week_start + timedelta(days=7)

    rows = await db.execute(
        select(Reservation, Timetable, User)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .where(
            Timetable.room_id == room_id,
            Timetable.start_at < week_end,
            Timetable.end_at > week_start,
        )
        .order_by(Timetable.start_at.asc())
    )

    reservations = [
        WeekReservationItem(
            id=reservation.id,
            title=reservation.title,
            start_at=timetable.start_at,
            end_at=timetable.end_at,
            created_by=CreatedByResponse(name=user.name),
        )
        for reservation, timetable, user in rows.all()
    ]

    return WeekTimetableResponse(
        room=RoomResponse(id=room_id, name=f"회의실{room_id}"),
        view="week",
        range=RangeResponse(start_at=week_start, end_at=week_end),
        grid_config=GridConfigResponse(day_start=day_start, day_end=day_end),
        reservations=reservations,
    )


async def _get_month_timetable(
    db: AsyncSession,
    room_id: str,
    month_start_date: date,
    preview_limit: int,
) -> MonthTimetableResponse:
    next_month_year = month_start_date.year + (1 if month_start_date.month == 12 else 0)
    next_month_month = 1 if month_start_date.month == 12 else month_start_date.month + 1
    month_end_date = date(next_month_year, next_month_month, 1)

    month_start = datetime.combine(month_start_date, time(0, 0), tzinfo=KST)
    month_end = datetime.combine(month_end_date, time(0, 0), tzinfo=KST)

    rows = await db.execute(
        select(Reservation.id, Reservation.title, Timetable.start_at)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .where(
            Timetable.room_id == room_id,
            Timetable.start_at >= month_start,
            Timetable.start_at < month_end,
        )
        .order_by(Timetable.start_at.asc())
    )

    grouped: dict[date, list[tuple[str, str, datetime]]] = defaultdict(list)
    for reservation_id, title, starts_at in rows.all():
        local_dt = starts_at.astimezone(KST)
        grouped[local_dt.date()].append((reservation_id, title, local_dt))

    days: list[MonthDayItem] = []
    for target_date in sorted(grouped.keys()):
        items = grouped[target_date]
        preview = [
            MonthPreviewItem(id=reservation_id, start_time=starts_at.strftime("%H:%M"), title=title)
            for reservation_id, title, starts_at in items[:preview_limit]
        ]
        days.append(
            MonthDayItem(
                date=target_date,
                total_count=len(items),
                preview=preview,
            )
        )

    return MonthTimetableResponse(
        room=RoomResponse(id=room_id, name=f"회의실{room_id}"),
        view="month",
        month=month_start_date.strftime("%Y-%m"),
        days=days,
    )


def _require_auth_user(request: Request) -> AuthUserModel | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return get_user_from_session_token(token)


def _parse_hhmm(value: str) -> time | None:
    try:
        parsed = datetime.strptime(value, "%H:%M")
    except ValueError:
        return None
    return parsed.time()


def _parse_month(value: str) -> date | None:
    try:
        parsed = datetime.strptime(value, "%Y-%m")
    except ValueError:
        return None
    return date(parsed.year, parsed.month, 1)


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
            }
        },
    )
