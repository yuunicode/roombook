from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.minutes_lock_repo import (
    add_or_update_minutes_lock,
    delete_minutes_lock,
    find_minutes_lock,
)
from app.infra.reservation import Reservation
from app.infra.reservation_attendee_repo import list_attendees_by_reservation_id, replace_reservation_attendees
from app.infra.reservation_repo import (
    add_reservation,
    find_owned_reservation_by_id,
    find_owned_reservation_with_timetable_and_creator,
    find_reservation_conflict,
    find_reservation_with_timetable_and_creator,
    list_all_reservations_with_timetable_and_creator,
)
from app.infra.room import Room
from app.infra.room_repo import find_room_by_id
from app.infra.timetable import Timetable
from app.infra.timetable_repo import add_timetable, find_timetable_by_room_and_time
from app.infra.user import User
from app.infra.user_repo import find_user_by_id
from app.service.auth_service import AuthUser
from app.service.domain import DomainError
from app.service.user_service import resolve_attendee_user_ids


@dataclass(frozen=True, slots=True)
class CreateReservationInput:
    room_id: str
    title: str
    label: str | None
    purpose: str | None
    agenda_url: str | None
    start_at: datetime
    end_at: datetime
    description: str | None
    attendees: list[str] | None
    external_attendees: str | None
    agenda: str | None
    meeting_content: str | None
    meeting_result: str | None
    minutes_attachment: str | None


@dataclass(frozen=True, slots=True)
class UpdateReservationInput:
    title: str | None
    label: str | None
    purpose: str | None
    agenda_url: str | None
    start_at: datetime | None
    end_at: datetime | None
    description: str | None
    attendees: list[str] | None
    external_attendees: str | None
    agenda: str | None
    meeting_content: str | None
    meeting_result: str | None
    minutes_attachment: str | None


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
    label: str
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
    label: str
    purpose: str | None
    agenda_url: str | None
    start_at: datetime
    end_at: datetime
    description: str | None
    external_attendees: str | None
    agenda: str | None
    meeting_content: str | None
    meeting_result: str | None
    minutes_attachment: str | None
    created_by_name: str
    created_by_email: str
    attendees: list[AttendeeItem]


@dataclass(frozen=True, slots=True)
class MinutesLockResult:
    reservation_id: str
    holder_user_id: str
    holder_name: str
    expires_at: datetime


async def create_reservation(
    payload: CreateReservationInput,
    auth_user_id: str,
    db: AsyncSession,
) -> CreateReservationResult | DomainError:
    owner = await find_user_by_id(db, auth_user_id)
    if owner is None:
        return DomainError(code="UNAUTHORIZED", message="로그인이 필요합니다.")

    room = await find_room_by_id(db, payload.room_id)
    if room is None:
        return DomainError(code="INVALID_ARGUMENT", message="존재하지 않는 회의 공간입니다.")

    if not _is_valid_datetime_range(payload.start_at, payload.end_at):
        return DomainError(code="INVALID_ARGUMENT", message="종료시간은 시작시간보다 커야 합니다.")

    attendee_user_ids = await resolve_attendee_user_ids(payload.attendees, db)
    if isinstance(attendee_user_ids, DomainError):
        return attendee_user_ids

    await _acquire_room_reservation_lock(db, payload.room_id)

    has_conflict = await find_reservation_conflict(
        db=db,
        room_id=payload.room_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    if has_conflict:
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    try:
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
            label=(payload.label or "").strip(),
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            description=payload.description,
            external_attendees=payload.external_attendees,
            agenda=payload.agenda,
            meeting_content=payload.meeting_content,
            meeting_result=payload.meeting_result,
            minutes_attachment=payload.minutes_attachment,
        )
        add_reservation(db, reservation)
        await db.flush()
        await replace_reservation_attendees(db, reservation.id, attendee_user_ids)
        await db.commit()
        await db.refresh(reservation)
    except IntegrityError:
        await db.rollback()
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    return CreateReservationResult(
        id=reservation.id,
        room_id=payload.room_id,
        room_name=room.name,
        title=reservation.title,
        label=reservation.label,
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

    reservation, timetable, creator, room = item
    return await _to_reservation_detail_result(reservation, timetable, creator, room, db)


async def get_reservation_minutes_detail(
    reservation_id: str,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    item = await find_reservation_with_timetable_and_creator(db, reservation_id)
    if item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")
    reservation, timetable, creator, room = item
    return await _to_reservation_detail_result(reservation, timetable, creator, room, db)


async def list_reservations_for_wiki(
    db: AsyncSession,
    recent_months: int | None = None,
    month: int | None = None,
    day: int | None = None,
    label: str | None = None,
    creator_keyword: str | None = None,
    attendee_keyword: str | None = None,
) -> list[ReservationDetailResult]:
    rows = await list_all_reservations_with_timetable_and_creator(db)

    threshold: datetime | None = None
    if recent_months is not None:
        threshold = datetime.now(UTC) - timedelta(days=recent_months * 31)

    creator_filter = creator_keyword.strip().lower() if creator_keyword else None
    attendee_filter = attendee_keyword.strip().lower() if attendee_keyword else None
    label_filter = label.strip() if label else None

    filtered: list[ReservationDetailResult] = []
    for reservation, timetable, creator, room in rows:
        if threshold is not None and timetable.start_at < threshold:
            continue
        if month is not None and timetable.start_at.month != month:
            continue
        if day is not None and timetable.start_at.day != day:
            continue
        if label_filter is not None and reservation.label != label_filter:
            continue
        if creator_filter is not None:
            creator_pool = f"{creator.name} {creator.email}".lower()
            if creator_filter not in creator_pool:
                continue

        detail = await _to_reservation_detail_result(reservation, timetable, creator, room, db)
        if attendee_filter is not None:
            attendee_pool = " ".join(
                [detail.external_attendees or "", *[f"{item.name} {item.email}" for item in detail.attendees]]
            ).lower()
            if attendee_filter not in attendee_pool:
                continue
        filtered.append(detail)

    return filtered


async def update_reservation(
    reservation_id: str,
    payload: UpdateReservationInput,
    auth_user_id: str,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    item = await find_owned_reservation_with_timetable_and_creator(db, reservation_id, auth_user_id)
    if item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")
    reservation, current_timetable, creator, room = item
    return await _update_reservation_internal(reservation, current_timetable, creator, room, payload, db)


async def update_reservation_minutes(
    reservation_id: str,
    payload: UpdateReservationInput,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    item = await find_reservation_with_timetable_and_creator(db, reservation_id)
    if item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")
    reservation, current_timetable, creator, room = item
    return await _update_reservation_internal(reservation, current_timetable, creator, room, payload, db)


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


async def get_minutes_lock(
    reservation_id: str,
    db: AsyncSession,
) -> MinutesLockResult | None:
    lock = await find_minutes_lock(db, reservation_id)
    if lock is None:
        return None
    if lock.expires_at <= datetime.now(UTC):
        await db.delete(lock)
        await db.commit()
        return None
    return MinutesLockResult(
        reservation_id=lock.reservation_id,
        holder_user_id=lock.holder_user_id,
        holder_name=lock.holder_name,
        expires_at=lock.expires_at,
    )


async def acquire_minutes_lock(
    reservation_id: str,
    holder: AuthUser,
    db: AsyncSession,
    ttl_seconds: int = 15,
) -> MinutesLockResult | DomainError:
    reservation_item = await find_reservation_with_timetable_and_creator(db, reservation_id)
    if reservation_item is None:
        return DomainError(code="NOT_FOUND", message="예약을 찾을 수 없습니다.")

    now = datetime.now(UTC)
    current = await find_minutes_lock(db, reservation_id)
    if current is not None and current.expires_at > now and current.holder_user_id != holder.id:
        return DomainError(code="LOCKED", message=f"{current.holder_name}가 수정하고있습니다.")

    expires_at = now + timedelta(seconds=max(5, min(ttl_seconds, 120)))
    lock = await add_or_update_minutes_lock(
        db=db,
        reservation_id=reservation_id,
        holder_user_id=holder.id,
        holder_name=holder.name,
        expires_at=expires_at,
    )
    await db.commit()
    return MinutesLockResult(
        reservation_id=lock.reservation_id,
        holder_user_id=lock.holder_user_id,
        holder_name=lock.holder_name,
        expires_at=lock.expires_at,
    )


async def release_minutes_lock(
    reservation_id: str,
    holder_user_id: str,
    db: AsyncSession,
) -> None | DomainError:
    current = await find_minutes_lock(db, reservation_id)
    if current is None:
        return None

    now = datetime.now(UTC)
    if current.expires_at > now and current.holder_user_id != holder_user_id:
        return DomainError(code="FORBIDDEN", message="다른 사용자가 보유한 수정 잠금입니다.")

    await delete_minutes_lock(db, reservation_id)
    await db.commit()
    return None


async def _update_reservation_internal(
    reservation: Reservation,
    current_timetable: Timetable,
    creator: User,
    room: Room | None,
    payload: UpdateReservationInput,
    db: AsyncSession,
) -> ReservationDetailResult | DomainError:
    next_title = payload.title if payload.title is not None else reservation.title
    next_label = payload.label if payload.label is not None else reservation.label
    next_purpose = payload.purpose if payload.purpose is not None else reservation.purpose
    next_agenda_url = payload.agenda_url if payload.agenda_url is not None else reservation.agenda_url
    next_description = payload.description if payload.description is not None else reservation.description
    next_start_at = payload.start_at if payload.start_at is not None else current_timetable.start_at
    next_end_at = payload.end_at if payload.end_at is not None else current_timetable.end_at
    next_external_attendees = (
        payload.external_attendees if payload.external_attendees is not None else reservation.external_attendees
    )
    next_agenda = payload.agenda if payload.agenda is not None else reservation.agenda
    next_meeting_content = (
        payload.meeting_content if payload.meeting_content is not None else reservation.meeting_content
    )
    next_meeting_result = payload.meeting_result if payload.meeting_result is not None else reservation.meeting_result
    next_minutes_attachment = (
        payload.minutes_attachment if payload.minutes_attachment is not None else reservation.minutes_attachment
    )

    attendee_user_ids: list[str] | None = None
    if payload.attendees is not None:
        resolved_attendees = await resolve_attendee_user_ids(payload.attendees, db)
        if isinstance(resolved_attendees, DomainError):
            return resolved_attendees
        attendee_user_ids = resolved_attendees

    if not _is_valid_datetime_range(next_start_at, next_end_at):
        return DomainError(code="INVALID_ARGUMENT", message="종료시간은 시작시간보다 커야 합니다.")

    await _acquire_room_reservation_lock(db, current_timetable.room_id)

    has_conflict = await find_reservation_conflict(
        db=db,
        room_id=current_timetable.room_id,
        start_at=next_start_at,
        end_at=next_end_at,
        exclude_reservation_id=reservation.id,
    )
    if has_conflict:
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    try:
        target_timetable = await _find_or_create_timetable(
            db=db,
            room_id=current_timetable.room_id,
            start_at=next_start_at,
            end_at=next_end_at,
        )

        reservation.title = next_title
        reservation.label = next_label
        reservation.purpose = next_purpose
        reservation.agenda_url = next_agenda_url
        reservation.description = next_description
        reservation.timetable_id = target_timetable.id
        reservation.external_attendees = next_external_attendees
        reservation.agenda = next_agenda
        reservation.meeting_content = next_meeting_content
        reservation.meeting_result = next_meeting_result
        reservation.minutes_attachment = next_minutes_attachment
        if attendee_user_ids is not None:
            await replace_reservation_attendees(db, reservation.id, attendee_user_ids)
        await db.commit()
        await db.refresh(reservation)
    except IntegrityError:
        await db.rollback()
        return DomainError(code="RESERVATION_CONFLICT", message="이미 해당 시간대에 예약이 존재합니다.")

    attendee_rows = await list_attendees_by_reservation_id(db, reservation.id)
    attendees = [AttendeeItem(id=user_id, name=name, email=email) for user_id, name, email in attendee_rows]
    return ReservationDetailResult(
        id=reservation.id,
        room_id=current_timetable.room_id,
        room_name=room.name if room is not None else current_timetable.room_id,
        title=reservation.title,
        label=reservation.label,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=next_start_at,
        end_at=next_end_at,
        description=reservation.description,
        external_attendees=reservation.external_attendees,
        agenda=reservation.agenda,
        meeting_content=reservation.meeting_content,
        meeting_result=reservation.meeting_result,
        minutes_attachment=reservation.minutes_attachment,
        created_by_name=creator.name,
        created_by_email=creator.email,
        attendees=attendees,
    )


async def _to_reservation_detail_result(
    reservation: Reservation,
    timetable: Timetable,
    creator: User,
    room: Room | None,
    db: AsyncSession,
) -> ReservationDetailResult:
    attendee_rows = await list_attendees_by_reservation_id(db, reservation.id)
    attendees = [AttendeeItem(id=user_id, name=name, email=email) for user_id, name, email in attendee_rows]
    return ReservationDetailResult(
        id=reservation.id,
        room_id=timetable.room_id,
        room_name=room.name if room is not None else timetable.room_id,
        title=reservation.title,
        label=reservation.label,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=timetable.start_at,
        end_at=timetable.end_at,
        description=reservation.description,
        external_attendees=reservation.external_attendees,
        agenda=reservation.agenda,
        meeting_content=reservation.meeting_content,
        meeting_result=reservation.meeting_result,
        minutes_attachment=reservation.minutes_attachment,
        created_by_name=creator.name,
        created_by_email=creator.email,
        attendees=attendees,
    )


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


async def _acquire_room_reservation_lock(db: AsyncSession, room_id: str) -> None:
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key)::bigint)"),
        {"lock_key": f"reservation-room:{room_id}"},
    )
