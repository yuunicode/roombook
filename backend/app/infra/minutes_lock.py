from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class MinutesLock(Base):
    __tablename__ = "minutes_locks"

    reservation_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    holder_user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    holder_name: Mapped[str] = mapped_column(String(100), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


async def find_minutes_lock(db: AsyncSession, reservation_id: str) -> MinutesLock | None:
    row = await db.execute(select(MinutesLock).where(MinutesLock.reservation_id == reservation_id))
    return row.scalar_one_or_none()


async def add_or_update_minutes_lock(
    db: AsyncSession,
    reservation_id: str,
    holder_user_id: str,
    holder_name: str,
    expires_at: datetime,
) -> MinutesLock:
    lock = await find_minutes_lock(db, reservation_id)
    if lock is None:
        lock = MinutesLock(
            reservation_id=reservation_id,
            holder_user_id=holder_user_id,
            holder_name=holder_name,
            expires_at=expires_at,
        )
        db.add(lock)
        return lock

    lock.holder_user_id = holder_user_id
    lock.holder_name = holder_name
    lock.expires_at = expires_at
    return lock


async def delete_minutes_lock(db: AsyncSession, reservation_id: str) -> bool:
    lock = await find_minutes_lock(db, reservation_id)
    if lock is None:
        return False
    await db.delete(lock)
    return True
