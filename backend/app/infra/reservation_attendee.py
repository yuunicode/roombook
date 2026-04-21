from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base
from app.infra.user import User


class ReservationAttendee(Base):
    __tablename__ = "reservation_attendees"

    reservation_id: Mapped[str] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


async def replace_reservation_attendees(db: AsyncSession, reservation_id: str, attendee_user_ids: list[str]) -> None:
    await db.execute(delete(ReservationAttendee).where(ReservationAttendee.reservation_id == reservation_id))
    for user_id in attendee_user_ids:
        db.add(ReservationAttendee(reservation_id=reservation_id, user_id=user_id))


async def list_attendees_by_reservation_id(db: AsyncSession, reservation_id: str) -> list[tuple[str, str, str]]:
    rows = await db.execute(
        select(User.id, User.name, User.email)
        .join(ReservationAttendee, ReservationAttendee.user_id == User.id)
        .where(ReservationAttendee.reservation_id == reservation_id)
        .order_by(User.name.asc())
    )
    return list(rows.tuples().all())
