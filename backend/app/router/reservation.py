from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.infra.reservation import Reservation
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
    start_at: datetime
    end_at: datetime
    description: str | None = None
    attendees: list[str] | None = None


class CreateReservationResponse(BaseModel):
    id: str
    room_id: str
    title: str
    start_at: datetime
    end_at: datetime
    created_at: datetime


class CreatedByResponse(BaseModel):
    name: str


class ReservationDetailResponse(BaseModel):
    id: str
    room_id: str
    title: str
    start_at: datetime
    end_at: datetime
    description: str | None = None
    created_by: CreatedByResponse


class UpdateReservationRequest(BaseModel):
    title: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    description: str | None = None


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
        description=payload.description,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)

    return CreateReservationResponse(
        id=reservation.id,
        room_id=payload.room_id,
        title=reservation.title,
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
        .where(Reservation.id == reservation_id)
    )
    item = row.first()
    if item is None:
        return _error_response(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "예약을 찾을 수 없습니다.")

    reservation, timetable, creator = item
    return ReservationDetailResponse(
        id=reservation.id,
        room_id=timetable.room_id,
        title=reservation.title,
        start_at=timetable.start_at,
        end_at=timetable.end_at,
        description=reservation.description,
        created_by=CreatedByResponse(name=creator.name),
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
        .where(Reservation.id == reservation_id)
    )
    item = row.first()
    if item is None:
        return _error_response(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "예약을 찾을 수 없습니다.")

    reservation, current_timetable, creator = item
    next_title = payload.title if payload.title is not None else reservation.title
    next_description = payload.description if payload.description is not None else reservation.description
    next_start_at = payload.start_at if payload.start_at is not None else current_timetable.start_at
    next_end_at = payload.end_at if payload.end_at is not None else current_timetable.end_at

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
    reservation.description = next_description
    reservation.timetable_id = target_timetable.id
    await db.commit()
    await db.refresh(reservation)

    return ReservationDetailResponse(
        id=reservation.id,
        room_id=current_timetable.room_id,
        title=reservation.title,
        start_at=next_start_at,
        end_at=next_end_at,
        description=reservation.description,
        created_by=CreatedByResponse(name=creator.name),
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

    reservation = await db.get(Reservation, reservation_id)
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
