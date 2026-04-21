from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base
from app.infra.room import Room
from app.infra.timetable import Timetable
from app.infra.user import User


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    timetable_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    purpose: Mapped[str | None] = mapped_column(String(500), nullable=True)
    agenda_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    external_attendees: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    agenda: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    meeting_content: Mapped[str | None] = mapped_column(String(8000), nullable=True)
    meeting_result: Mapped[str | None] = mapped_column(String(8000), nullable=True)
    minutes_attachment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def add_reservation(db: AsyncSession, reservation: Reservation) -> None:
    db.add(reservation)


async def find_owned_reservation_by_id(db: AsyncSession, reservation_id: str, user_id: str) -> Reservation | None:
    row = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.user_id == user_id,
        )
    )
    return row.scalar_one_or_none()


async def find_owned_reservation_with_timetable_and_creator(
    db: AsyncSession, reservation_id: str, user_id: str
) -> tuple[Reservation, Timetable, User, Room | None] | None:
    row = await db.execute(
        select(Reservation, Timetable, User, Room)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .outerjoin(Room, Room.id == Timetable.room_id)
        .where(Reservation.id == reservation_id, Reservation.user_id == user_id)
    )
    item = row.tuples().first()
    if item is None:
        return None
    return item


async def find_reservation_with_timetable_and_creator(
    db: AsyncSession, reservation_id: str
) -> tuple[Reservation, Timetable, User, Room | None] | None:
    row = await db.execute(
        select(Reservation, Timetable, User, Room)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .outerjoin(Room, Room.id == Timetable.room_id)
        .where(Reservation.id == reservation_id)
    )
    item = row.tuples().first()
    if item is None:
        return None
    return item


async def find_reservation_conflict(
    db: AsyncSession,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_reservation_id: str | None = None,
) -> bool:
    stmt = (
        select(Reservation.id)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .where(
            Timetable.room_id == room_id,
            Timetable.start_at < end_at,
            Timetable.end_at > start_at,
        )
        .limit(1)
    )
    if exclude_reservation_id is not None:
        stmt = stmt.where(Reservation.id != exclude_reservation_id)

    row = await db.execute(stmt)
    return row.scalar_one_or_none() is not None


async def list_week_reservations(
    db: AsyncSession,
    room_id: str,
    user_id: str,
    week_start: datetime,
    week_end: datetime,
) -> list[tuple[Reservation, Timetable, User]]:
    rows = await db.execute(
        select(Reservation, Timetable, User)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .where(
            Reservation.user_id == user_id,
            Timetable.room_id == room_id,
            Timetable.start_at < week_end,
            Timetable.end_at > week_start,
        )
        .order_by(Timetable.start_at.asc())
    )
    return list(rows.tuples().all())


async def list_month_preview_rows(
    db: AsyncSession,
    room_id: str,
    user_id: str,
    month_start: datetime,
    month_end: datetime,
) -> list[tuple[str, str, datetime]]:
    rows = await db.execute(
        select(Reservation.id, Reservation.title, Timetable.start_at)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .where(
            Reservation.user_id == user_id,
            Timetable.room_id == room_id,
            Timetable.start_at >= month_start,
            Timetable.start_at < month_end,
        )
        .order_by(Timetable.start_at.asc())
    )
    return list(rows.tuples().all())


async def list_all_reservations_with_timetable_and_creator(
    db: AsyncSession,
) -> list[tuple[Reservation, Timetable, User, Room | None]]:
    rows = await db.execute(
        select(Reservation, Timetable, User, Room)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .outerjoin(Room, Room.id == Timetable.room_id)
        .order_by(Timetable.start_at.desc())
    )
    return list(rows.tuples().all())
