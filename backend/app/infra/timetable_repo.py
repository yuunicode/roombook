from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.timetable import Timetable


async def find_timetable_by_room_and_time(
    db: AsyncSession,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
) -> Timetable | None:
    row = await db.execute(
        select(Timetable).where(
            Timetable.room_id == room_id,
            Timetable.start_at == start_at,
            Timetable.end_at == end_at,
        )
    )
    return row.scalar_one_or_none()


def add_timetable(db: AsyncSession, timetable: Timetable) -> None:
    db.add(timetable)
