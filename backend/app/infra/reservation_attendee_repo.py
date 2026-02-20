from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.reservation_attendee import ReservationAttendee
from app.infra.user import User


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
