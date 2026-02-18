from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.infra.reservation import Reservation
from app.infra.reservation_attendee import ReservationAttendee
from app.infra.room_catalog import resolve_room_name
from app.infra.timetable import Timetable
from app.infra.user import User
from app.infra.user_schema import AuthUserModel
from app.service.auth_service import get_user_from_session_token

router = APIRouter(prefix="/api/reservations", tags=["reservation"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class CreateReservationRequest(BaseModel):
    room_id: str = "A"
    title: str
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    description: str | None = None
    attendees: list[str] | None = None


class CreateReservationResponse(BaseModel):
    id: str
    room_id: str
    room_name: str
    title: str
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    created_at: datetime


class CreatedByResponse(BaseModel):
    name: str


class AttendeeResponse(BaseModel):
    id: str
    name: str
    email: str


class ReservationDetailResponse(BaseModel):
    id: str
    room_id: str
    room_name: str
    title: str
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    description: str | None = None
    created_by: CreatedByResponse
    attendees: list[AttendeeResponse]


class UpdateReservationRequest(BaseModel):
    title: str | None = None
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    description: str | None = None
    attendees: list[str] | None = None


@router.post(
    "",
    response_model=CreateReservationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def create_reservation(
    payload: CreateReservationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CreateReservationResponse | JSONResponse:
    auth_user = _require_auth_user(request)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    db_user = await _find_user_by_id(db, auth_user.id)
    if db_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    if not _is_valid_datetime_range(payload.start_at, payload.end_at):
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "종료시간은 시작시간보다 커야 합니다.")

    attendee_user_ids = await _resolve_attendee_user_ids(db, payload.attendees)
    if attendee_user_ids is None:
        return _error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_ARGUMENT",
            "attendees에 존재하지 않는 사용자가 포함되어 있습니다.",
        )

    if await _has_conflict(
        db=db,
        room_id=payload.room_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    ):
        return _error_response(
            status.HTTP_409_CONFLICT,
            "RESERVATION_CONFLICT",
            "이미 해당 시간대에 예약이 존재합니다.",
        )

    timetable = await _find_or_create_timetable(
        db=db,
        room_id=payload.room_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )

    reservation = Reservation(
        id=_new_id("rsv"),
        timetable_id=timetable.id,
        user_id=auth_user.id,
        title=payload.title,
        purpose=payload.purpose,
        agenda_url=payload.agenda_url,
        description=payload.description,
    )
    db.add(reservation)
    await db.flush()
    await _replace_reservation_attendees(db, reservation.id, attendee_user_ids)
    await db.commit()
    await db.refresh(reservation)

    return CreateReservationResponse(
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


@router.get(
    "/{reservation_id}",
    response_model=ReservationDetailResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_reservation(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = _require_auth_user(request)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    row = await db.execute(
        select(Reservation, Timetable, User)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .where(Reservation.id == reservation_id, Reservation.user_id == auth_user.id)
    )
    item = row.first()
    if item is None:
        return _error_response(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "예약을 찾을 수 없습니다.")

    reservation, timetable, creator = item
    attendees = await _get_reservation_attendees(db, reservation.id)
    return ReservationDetailResponse(
        id=reservation.id,
        room_id=timetable.room_id,
        room_name=resolve_room_name(timetable.room_id),
        title=reservation.title,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=timetable.start_at,
        end_at=timetable.end_at,
        description=reservation.description,
        created_by=CreatedByResponse(name=creator.name),
        attendees=attendees,
    )


@router.patch(
    "/{reservation_id}",
    response_model=ReservationDetailResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
async def update_reservation(
    reservation_id: str,
    payload: UpdateReservationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = _require_auth_user(request)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    row = await db.execute(
        select(Reservation, Timetable, User)
        .join(Timetable, Timetable.id == Reservation.timetable_id)
        .join(User, User.id == Reservation.user_id)
        .where(Reservation.id == reservation_id, Reservation.user_id == auth_user.id)
    )
    item = row.first()
    if item is None:
        return _error_response(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "예약을 찾을 수 없습니다.")

    reservation, current_timetable, creator = item
    next_title = payload.title if payload.title is not None else reservation.title
    next_purpose = payload.purpose if payload.purpose is not None else reservation.purpose
    next_agenda_url = payload.agenda_url if payload.agenda_url is not None else reservation.agenda_url
    next_description = payload.description if payload.description is not None else reservation.description
    next_start_at = payload.start_at if payload.start_at is not None else current_timetable.start_at
    next_end_at = payload.end_at if payload.end_at is not None else current_timetable.end_at
    attendee_user_ids: list[str] | None = None
    if payload.attendees is not None:
        attendee_user_ids = await _resolve_attendee_user_ids(db, payload.attendees)
        if attendee_user_ids is None:
            return _error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_ARGUMENT",
                "attendees에 존재하지 않는 사용자가 포함되어 있습니다.",
            )

    if not _is_valid_datetime_range(next_start_at, next_end_at):
        return _error_response(status.HTTP_400_BAD_REQUEST, "INVALID_ARGUMENT", "종료시간은 시작시간보다 커야 합니다.")

    if await _has_conflict(
        db=db,
        room_id=current_timetable.room_id,
        start_at=next_start_at,
        end_at=next_end_at,
        exclude_reservation_id=reservation.id,
    ):
        return _error_response(
            status.HTTP_409_CONFLICT,
            "RESERVATION_CONFLICT",
            "이미 해당 시간대에 예약이 존재합니다.",
        )

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
    if payload.attendees is not None and attendee_user_ids is not None:
        await _replace_reservation_attendees(db, reservation.id, attendee_user_ids)
    await db.commit()
    await db.refresh(reservation)
    attendees = await _get_reservation_attendees(db, reservation.id)

    return ReservationDetailResponse(
        id=reservation.id,
        room_id=current_timetable.room_id,
        room_name=resolve_room_name(current_timetable.room_id),
        title=reservation.title,
        purpose=reservation.purpose,
        agenda_url=reservation.agenda_url,
        start_at=next_start_at,
        end_at=next_end_at,
        description=reservation.description,
        created_by=CreatedByResponse(name=creator.name),
        attendees=attendees,
    )


@router.delete(
    "/{reservation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def delete_reservation(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    auth_user = _require_auth_user(request)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    row = await db.execute(
        select(Reservation).where(Reservation.id == reservation_id, Reservation.user_id == auth_user.id)
    )
    reservation = row.scalar_one_or_none()
    if reservation is None:
        return _error_response(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "예약을 찾을 수 없습니다.")

    await db.delete(reservation)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _require_auth_user(request: Request) -> AuthUserModel | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return get_user_from_session_token(token)


def _is_valid_datetime_range(start_at: datetime, end_at: datetime) -> bool:
    if start_at.tzinfo is None or end_at.tzinfo is None:
        return False
    return end_at > start_at


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


async def _replace_reservation_attendees(db: AsyncSession, reservation_id: str, attendee_user_ids: list[str]) -> None:
    await db.execute(delete(ReservationAttendee).where(ReservationAttendee.reservation_id == reservation_id))
    for user_id in attendee_user_ids:
        db.add(ReservationAttendee(reservation_id=reservation_id, user_id=user_id))


async def _get_reservation_attendees(db: AsyncSession, reservation_id: str) -> list[AttendeeResponse]:
    rows = await db.execute(
        select(User.id, User.name, User.email)
        .join(ReservationAttendee, ReservationAttendee.user_id == User.id)
        .where(ReservationAttendee.reservation_id == reservation_id)
        .order_by(User.name.asc())
    )
    return [AttendeeResponse(id=user_id, name=name, email=email) for user_id, name, email in rows.all()]


async def _resolve_attendee_user_ids(db: AsyncSession, attendees: list[str] | None) -> list[str] | None:
    if attendees is None:
        return []
    cleaned = list(dict.fromkeys(item.strip() for item in attendees if item.strip()))
    if not cleaned:
        return []

    rows = await db.execute(select(User.id, User.email).where((User.id.in_(cleaned)) | (User.email.in_(cleaned))))
    resolved: dict[str, str] = {}
    for user_id, email in rows.all():
        resolved[user_id] = user_id
        resolved[email] = user_id

    try:
        return [resolved[item] for item in cleaned]
    except KeyError:
        return None


async def _find_or_create_timetable(
    db: AsyncSession,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
) -> Timetable:
    row = await db.execute(
        select(Timetable).where(
            Timetable.room_id == room_id,
            Timetable.start_at == start_at,
            Timetable.end_at == end_at,
        )
    )
    timetable = row.scalar_one_or_none()
    if timetable is not None:
        return timetable

    timetable = Timetable(
        id=_new_id("ttb"),
        room_id=room_id,
        start_at=start_at,
        end_at=end_at,
    )
    db.add(timetable)
    await db.flush()
    return timetable


async def _find_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    row = await db.execute(select(User).where(User.id == user_id))
    return row.scalar_one_or_none()


async def _has_conflict(
    db: AsyncSession,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_reservation_id: str | None = None,
) -> bool:
    stmt: Select[tuple[str]] = (
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


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
            }
        },
    )
