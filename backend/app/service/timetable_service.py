from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.reservation_repo import list_month_preview_rows, list_week_reservations
from app.infra.room_catalog import resolve_room_name

KST = ZoneInfo("Asia/Seoul")


@dataclass(frozen=True, slots=True)
class WeekReservationItem:
    id: str
    title: str
    start_at: datetime
    end_at: datetime
    created_by_name: str


@dataclass(frozen=True, slots=True)
class WeekTimetableResult:
    room_id: str
    room_name: str
    view: str
    range_start_at: datetime
    range_end_at: datetime
    day_start: str
    day_end: str
    reservations: list[WeekReservationItem]


@dataclass(frozen=True, slots=True)
class MonthPreviewItem:
    id: str
    start_time: str
    title: str


@dataclass(frozen=True, slots=True)
class MonthDayItem:
    date: date
    total_count: int
    preview: list[MonthPreviewItem]


@dataclass(frozen=True, slots=True)
class MonthTimetableResult:
    room_id: str
    room_name: str
    view: str
    month: str
    days: list[MonthDayItem]


async def get_week_timetable(
    db: AsyncSession,
    room_id: str,
    user_id: str,
    anchor_date: date,
    day_start: str,
    day_end: str,
) -> WeekTimetableResult:
    week_start_date = anchor_date - timedelta(days=anchor_date.weekday())
    week_start = datetime.combine(week_start_date, time(0, 0), tzinfo=KST)
    week_end = week_start + timedelta(days=7)

    rows = await list_week_reservations(db, room_id, user_id, week_start, week_end)
    reservations = [
        WeekReservationItem(
            id=reservation.id,
            title=reservation.title,
            start_at=timetable.start_at,
            end_at=timetable.end_at,
            created_by_name=user.name,
        )
        for reservation, timetable, user in rows
    ]
    return WeekTimetableResult(
        room_id=room_id,
        room_name=resolve_room_name(room_id),
        view="week",
        range_start_at=week_start,
        range_end_at=week_end,
        day_start=day_start,
        day_end=day_end,
        reservations=reservations,
    )


async def get_month_timetable(
    db: AsyncSession,
    room_id: str,
    user_id: str,
    month_start_date: date,
    preview_limit: int,
) -> MonthTimetableResult:
    next_month_year = month_start_date.year + (1 if month_start_date.month == 12 else 0)
    next_month_month = 1 if month_start_date.month == 12 else month_start_date.month + 1
    month_end_date = date(next_month_year, next_month_month, 1)

    month_start = datetime.combine(month_start_date, time(0, 0), tzinfo=KST)
    month_end = datetime.combine(month_end_date, time(0, 0), tzinfo=KST)

    rows = await list_month_preview_rows(db, room_id, user_id, month_start, month_end)
    grouped: dict[date, list[tuple[str, str, datetime]]] = defaultdict(list)
    for reservation_id, title, starts_at in rows:
        local_dt = starts_at.astimezone(KST)
        grouped[local_dt.date()].append((reservation_id, title, local_dt))

    days: list[MonthDayItem] = []
    for target_date in sorted(grouped.keys()):
        items = grouped[target_date]
        preview = [
            MonthPreviewItem(
                id=reservation_id,
                start_time=starts_at.strftime("%H:%M"),
                title=title,
            )
            for reservation_id, title, starts_at in items[:preview_limit]
        ]
        days.append(MonthDayItem(date=target_date, total_count=len(items), preview=preview))

    return MonthTimetableResult(
        room_id=room_id,
        room_name=resolve_room_name(room_id),
        view="month",
        month=month_start_date.strftime("%Y-%m"),
        days=days,
    )
