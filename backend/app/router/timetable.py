from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.timetable_service import get_month_timetable, get_week_timetable

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


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
    auth_user = await _require_auth_user(request, db)
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
        week_result = await get_week_timetable(
            db=db,
            room_id=room_id,
            user_id=auth_user.id,
            anchor_date=anchor_date,
            day_start=start_at,
            day_end=end_at,
        )
        return WeekTimetableResponse(
            room=RoomResponse(id=week_result.room_id, name=week_result.room_name),
            view=week_result.view,
            range=RangeResponse(start_at=week_result.range_start_at, end_at=week_result.range_end_at),
            grid_config=GridConfigResponse(day_start=week_result.day_start, day_end=week_result.day_end),
            reservations=[
                WeekReservationItem(
                    id=item.id,
                    title=item.title,
                    start_at=item.start_at,
                    end_at=item.end_at,
                    created_by=CreatedByResponse(name=item.created_by_name),
                )
                for item in week_result.reservations
            ],
        )

    if month is None:
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "month는 필수입니다.")
    parsed_month = _parse_month(month)
    if parsed_month is None:
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "month 형식은 YYYY-MM 이어야 합니다.")
    month_result = await get_month_timetable(
        db=db,
        room_id=room_id,
        user_id=auth_user.id,
        month_start_date=parsed_month,
        preview_limit=preview_limit,
    )
    return MonthTimetableResponse(
        room=RoomResponse(id=month_result.room_id, name=month_result.room_name),
        view=month_result.view,
        month=month_result.month,
        days=[
            MonthDayItem(
                date=item.date,
                total_count=item.total_count,
                preview=[
                    MonthPreviewItem(id=preview.id, start_time=preview.start_time, title=preview.title)
                    for preview in item.preview
                ],
            )
            for item in month_result.days
        ],
    )


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


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
