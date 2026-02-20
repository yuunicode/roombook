from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.reservation import Reservation
from app.infra.reservation_attendee_repo import list_attendees_by_reservation_id, replace_reservation_attendees
from app.infra.reservation_repo import (
    add_reservation,
    find_owned_reservation_by_id,
    find_owned_reservation_with_timetable_and_creator,
    find_reservation_conflict,
)
from app.infra.room_catalog import resolve_room_name
from app.infra.timetable import Timetable
from app.infra.timetable_repo import add_timetable, find_timetable_by_room_and_time
from app.infra.user_repo import find_user_by_id
from app.service.domain import DomainError
from app.service.user_service import resolve_attendee_user_ids


@dataclass(frozen=True, slots=True)
class CreateReservationInput:
    room_id: str
    title: str
    purpose: str | None
    agenda_url: str | None
    start_at: datetime
    end_at: datetime
    description: str | None
    attendees: list[str] | None


@dataclass(frozen=True, slots=True)
class UpdateReservationInput:
    title: str | None
    purpose: str | None
    agenda_url: str | None
    start_at: datetime | None
    end_at: datetime | None
    description: str | None
    attendees: list[str] | None


@dataclass(frozen=True, slots=True)
class AttendeeItem:
    id: str
    name: str
    email: str


@dataclass(frozen=True, slots=True)
class CreateReservationResult:
    id: str
    room_id: str
    room_name: str
    title: str
    purpose: str | None
    agenda_url: str | None
    start_at: datetime
    end_at: datetime
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ReservationDetailResult:
    id: str
    room_id: str
    room_name: str
    title: str
    purpose: str | None
    agenda_url: str | None
    start_at: datetime
    end_at: datetime
    description: str | None
    created_by_name: str
    attendees: list[AttendeeItem]


async def create_reservation(
    payload: CreateReservationInput,
    auth_user_id: str,
    db: AsyncSession,
) -> CreateReservationResult | DomainError:
    owner = await find_user_by_id(db, auth_user_id)
    if owner is None:
        return DomainError(code="UNAUTHORIZED", message="로그인이 필요합니다.")

    if not _is_valid_datetime_range(payload.start_at, payload.end_at):
        return DomainError(code="INVALID_ARGUMENT", message="종료시간은 시작시간보다 커야 합니다.")

    attendee_user_ids = await resolve_attendee_user_ids(payload.attendees, db)
    if isinstance(attendee_user_ids, DomainError):
        return attendee_user_ids

    has_conflict = await find_reservation_conflict(
        db=db,
        room_id=payload.room_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    if has_conflict:
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    timetable = await _find_or_create_timetable(
        db=db,
        room_id=payload.room_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    reservation = Reservation(
        id=_new_id("rsv"),
        timetable_id=timetable.id,
        user_id=auth_user_id,
        title=payload.title,
        purpose=payload.purpose,
        agenda_url=payload.agenda_url,
        description=payload.description,
    )
    add_reservation(db, reservation)
    await db.flush()
    await replace_reservation_attendees(db, reservation.id, attendee_user_ids)
    await db.commit()
    await db.refresh(reservation)

    return CreateReservationResult(
        id=reservation.id,
        room_id=payload.room_id,
        room_name=resolve_room_name(payload.room_id),
        title=reservation.title,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=payload.start_at,
        end_at=payload.end_at,
        created_at=reservation.created_at,
    )


async def get_reservation_detail(
    reservation_id: str,
    auth_user_id: str,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    item = await find_owned_reservation_with_timetable_and_creator(db, reservation_id, auth_user_id)
    if item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")

    reservation, timetable, creator = item
    attendee_rows = await list_attendees_by_reservation_id(db, reservation.id)
    attendees = [AttendeeItem(id=user_id, name=name, email=email) for user_id, name, email in attendee_rows]
    return ReservationDetailResult(
        id=reservation.id,
        room_id=timetable.room_id,
        room_name=resolve_room_name(timetable.room_id),
        title=reservation.title,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=timetable.start_at,
        end_at=timetable.end_at,
        description=reservation.description,
        created_by_name=creator.name,
        attendees=attendees,
    )


async def update_reservation(
    reservation_id: str,
    payload: UpdateReservationInput,
    auth_user_id: str,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    item = await find_owned_reservation_with_timetable_and_creator(db, reservation_id, auth_user_id)
    if item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")

    reservation, current_timetable, creator = item
    next_title = payload.title if payload.title is not None else reservation.title
    next_purpose = payload.purpose if payload.purpose is not None else reservation.purpose
    next_agenda_url = payload.agenda_url if payload.agenda_url is not None else reservation.agenda_url
    next_description = payload.description if payload.description is not None else reservation.description
    next_start_at = payload.start_at if payload.start_at is not None else current_timetable.start_at
    next_end_at = payload.end_at if payload.end_at is not None else current_timetable.end_at

    attendee_user_ids: list[str] | None = None
    if payload.attendees is not None:
        resolved_attendees = await resolve_attendee_user_ids(payload.attendees, db)
        if isinstance(resolved_attendees, DomainError):
            return resolved_attendees
        attendee_user_ids = resolved_attendees

    if not _is_valid_datetime_range(next_start_at, next_end_at):
        return DomainError(code="INVALID_ARGUMENT", message="종료시간은 시작시간보다 커야 합니다.")

    has_conflict = await find_reservation_conflict(
        db=db,
        room_id=current_timetable.room_id,
        start_at=next_start_at,
        end_at=next_end_at,
        exclude_reservation_id=reservation.id,
    )
    if has_conflict:
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    target_timetable = await _find_or_create_timetable(
        db=db,
        room_id=current_timetable.room_id,
        start_at=next_start_at,
        end_at=next_end_at,
    )

    reservation.title = next_title
    reservation.purpose = next_purpose
    reservation.agenda_url = next_agenda_url
    reservation.description = next_description
    reservation.timetable_id = target_timetable.id
    if attendee_user_ids is not None:
        await replace_reservation_attendees(db, reservation.id, attendee_user_ids)
    await db.commit()
    await db.refresh(reservation)

    attendee_rows = await list_attendees_by_reservation_id(db, reservation.id)
    attendees = [AttendeeItem(id=user_id, name=name, email=email) for user_id, name, email in attendee_rows]
    return ReservationDetailResult(
        id=reservation.id,
        room_id=current_timetable.room_id,
        room_name=resolve_room_name(current_timetable.room_id),
        title=reservation.title,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=next_start_at,
        end_at=next_end_at,
        description=reservation.description,
        created_by_name=creator.name,
        attendees=attendees,
    )


async def delete_reservation(
    reservation_id: str,
    auth_user_id: str,
    db: AsyncSession,
) -> None | DomainError:
    reservation = await find_owned_reservation_by_id(db, reservation_id, auth_user_id)
    if reservation is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")

    await db.delete(reservation)
    await db.commit()
    return None


async def _find_or_create_timetable(
    db: AsyncSession,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
) -> Timetable:
    timetable = await find_timetable_by_room_and_time(db, room_id, start_at, end_at)
    if timetable is not None:
        return timetable

    timetable = Timetable(
        id=_new_id("ttb"),
        room_id=room_id,
        start_at=start_at,
        end_at=end_at,
    )
    add_timetable(db, timetable)
    await db.flush()
    return timetable


def _is_valid_datetime_range(start_at: datetime, end_at: datetime) -> bool:
    if start_at.tzinfo is None or end_at.tzinfo is None:
        return False
    return end_at > start_at


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"
