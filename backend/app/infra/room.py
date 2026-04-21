from datetime import datetime

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


async def find_room_by_id(db: AsyncSession, room_id: str) -> Room | None:
    row = await db.execute(select(Room).where(Room.id == room_id))
    return row.scalar_one_or_none()


async def list_rooms(db: AsyncSession) -> list[Room]:
    rows = await db.execute(select(Room).order_by(Room.id.asc()))
    return list(rows.scalars().all())
