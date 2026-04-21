from datetime import datetime

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base
from app.infra.reservation import Reservation


class ReservationLabel(Base):
    __tablename__ = "reservation_labels"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def add_reservation_label(db: AsyncSession, name: str) -> None:
    db.add(ReservationLabel(name=name))


async def find_reservation_label(db: AsyncSession, name: str) -> ReservationLabel | None:
    row = await db.execute(select(ReservationLabel).where(ReservationLabel.name == name))
    return row.scalar_one_or_none()


async def list_reservation_labels(db: AsyncSession) -> list[str]:
    rows = await db.execute(select(ReservationLabel.name).order_by(ReservationLabel.name.asc()))
    return [name for (name,) in rows.tuples().all()]


async def rename_reservation_label(db: AsyncSession, old_name: str, new_name: str) -> int:
    rows = await db.execute(select(Reservation).where(Reservation.label == old_name))
    count = 0
    for reservation in rows.scalars().all():
        reservation.label = new_name
        count += 1
    return count


async def replace_reservation_label_with_none(db: AsyncSession, old_name: str) -> int:
    rows = await db.execute(select(Reservation).where(Reservation.label == old_name))
    count = 0
    for reservation in rows.scalars().all():
        reservation.label = "없음"
        count += 1
    return count


async def delete_reservation_label(db: AsyncSession, name: str) -> bool:
    label = await find_reservation_label(db, name)
    if label is None:
        return False
    await db.delete(label)
    return True
