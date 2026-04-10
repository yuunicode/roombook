from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.room import Room


async def find_room_by_id(db: AsyncSession, room_id: str) -> Room | None:
    row = await db.execute(select(Room).where(Room.id == room_id))
    return row.scalar_one_or_none()


async def list_rooms(db: AsyncSession) -> list[Room]:
    rows = await db.execute(select(Room).order_by(Room.id.asc()))
    return list(rows.scalars().all())
