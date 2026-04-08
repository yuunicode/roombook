from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.domain import DomainError
from app.service.reservation_service import (
    CreateReservationInput,
    MinutesLockResult,
    ReservationDetailResult,
    UpdateReservationInput,
    acquire_minutes_lock,
    create_reservation,
    delete_reservation,
    get_minutes_lock,
    get_reservation_detail,
    get_reservation_minutes_detail,
    list_reservations_for_wiki,
    release_minutes_lock,
    update_reservation,
    update_reservation_minutes,
)

router = APIRouter(prefix="/api/reservations", tags=["reservation"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class CreateReservationRequest(BaseModel):
    room_id: str = "A"
    title: str
    label: str | None = None
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    description: str | None = None
    attendees: list[str] | None = None
    external_attendees: str | None = None
    agenda: str | None = None
    meeting_content: str | None = None
    meeting_result: str | None = None
    minutes_attachment: str | None = None


class CreateReservationResponse(BaseModel):
    id: str
    room_id: str
    room_name: str
    title: str
    label: str
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    created_at: datetime


class CreatedByResponse(BaseModel):
    name: str
    email: str


class AttendeeResponse(BaseModel):
    id: str
    name: str
    email: str


class ReservationDetailResponse(BaseModel):
    id: str
    room_id: str
    room_name: str
    title: str
    label: str
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime
    end_at: datetime
    description: str | None = None
    external_attendees: str | None = None
    agenda: str | None = None
    meeting_content: str | None = None
    meeting_result: str | None = None
    minutes_attachment: str | None = None
    created_by: CreatedByResponse
    attendees: list[AttendeeResponse]


class UpdateReservationRequest(BaseModel):
    title: str | None = None
    label: str | None = None
    purpose: str | None = None
    agenda_url: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    description: str | None = None
    attendees: list[str] | None = None
    external_attendees: str | None = None
    agenda: str | None = None
    meeting_content: str | None = None
    meeting_result: str | None = None
    minutes_attachment: str | None = None


class MinutesLockAcquireRequest(BaseModel):
    ttl_seconds: int = 15


class MinutesLockResponse(BaseModel):
    reservation_id: str
    holder_user_id: str
    holder_name: str
    expires_at: datetime


@router.post(
    "",
    response_model=CreateReservationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def create_reservation_api(
    payload: CreateReservationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CreateReservationResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await create_reservation(
        payload=CreateReservationInput(
            room_id=payload.room_id,
            title=payload.title,
            label=payload.label,
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
            attendees=payload.attendees,
            external_attendees=payload.external_attendees,
            agenda=payload.agenda,
            meeting_content=payload.meeting_content,
            meeting_result=payload.meeting_result,
            minutes_attachment=payload.minutes_attachment,
        ),
        auth_user_id=auth_user.id,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return CreateReservationResponse(
        id=result.id,
        room_id=result.room_id,
        room_name=result.room_name,
        title=result.title,
        label=result.label,
        purpose=result.purpose,
        agenda_url=result.agenda_url,
        start_at=result.start_at,
        end_at=result.end_at,
        created_at=result.created_at,
    )


@router.get(
    "",
    response_model=list[ReservationDetailResponse],
    responses={401: {"model": ErrorResponse}},
)
async def list_reservations_for_wiki_api(
    request: Request,
    recent_months: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    day: int | None = Query(None, ge=1, le=31),
    label: str | None = Query(None),
    creator: str | None = Query(None),
    attendee: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> list[ReservationDetailResponse] | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    rows = await list_reservations_for_wiki(
        db=db,
        recent_months=recent_months,
        month=month,
        day=day,
        label=label,
        creator_keyword=creator,
        attendee_keyword=attendee,
    )
    return [_to_reservation_detail_response(row) for row in rows]


@router.get(
    "/{reservation_id}",
    response_model=ReservationDetailResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_reservation_api(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await get_reservation_detail(reservation_id, auth_user.id, db)
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return _to_reservation_detail_response(result)


@router.get(
    "/{reservation_id}/minutes",
    response_model=ReservationDetailResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def get_reservation_minutes_api(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await get_reservation_minutes_detail(reservation_id, db)
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return _to_reservation_detail_response(result)


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
async def update_reservation_api(
    reservation_id: str,
    payload: UpdateReservationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await update_reservation(
        reservation_id=reservation_id,
        payload=UpdateReservationInput(
            title=payload.title,
            label=payload.label,
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
            attendees=payload.attendees,
            external_attendees=payload.external_attendees,
            agenda=payload.agenda,
            meeting_content=payload.meeting_content,
            meeting_result=payload.meeting_result,
            minutes_attachment=payload.minutes_attachment,
        ),
        auth_user_id=auth_user.id,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return _to_reservation_detail_response(result)


@router.patch(
    "/{reservation_id}/minutes",
    response_model=ReservationDetailResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
async def update_reservation_minutes_api(
    reservation_id: str,
    payload: UpdateReservationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ReservationDetailResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await update_reservation_minutes(
        reservation_id=reservation_id,
        payload=UpdateReservationInput(
            title=payload.title,
            label=payload.label,
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
            attendees=payload.attendees,
            external_attendees=payload.external_attendees,
            agenda=payload.agenda,
            meeting_content=payload.meeting_content,
            meeting_result=payload.meeting_result,
            minutes_attachment=payload.minutes_attachment,
        ),
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return _to_reservation_detail_response(result)


@router.get(
    "/{reservation_id}/minutes-lock",
    response_model=MinutesLockResponse | None,
    responses={401: {"model": ErrorResponse}},
)
async def get_minutes_lock_api(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MinutesLockResponse | None | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")
    result = await get_minutes_lock(reservation_id=reservation_id, db=db)
    return _to_minutes_lock_response(result) if result is not None else None


@router.post(
    "/{reservation_id}/minutes-lock",
    response_model=MinutesLockResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def acquire_minutes_lock_api(
    reservation_id: str,
    payload: MinutesLockAcquireRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> MinutesLockResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")
    result = await acquire_minutes_lock(
        reservation_id=reservation_id,
        holder=auth_user,
        db=db,
        ttl_seconds=payload.ttl_seconds,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)
    return _to_minutes_lock_response(result)


@router.delete(
    "/{reservation_id}/minutes-lock",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def release_minutes_lock_api(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")
    result = await release_minutes_lock(
        reservation_id=reservation_id,
        holder_user_id=auth_user.id,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{reservation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def delete_reservation_api(
    reservation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await delete_reservation(reservation_id, auth_user.id, db)
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


def _to_reservation_detail_response(result: ReservationDetailResult) -> ReservationDetailResponse:
    return ReservationDetailResponse(
        id=result.id,
        room_id=result.room_id,
        room_name=result.room_name,
        title=result.title,
        label=result.label,
        purpose=result.purpose,
        agenda_url=result.agenda_url,
        start_at=result.start_at,
        end_at=result.end_at,
        description=result.description,
        external_attendees=result.external_attendees,
        agenda=result.agenda,
        meeting_content=result.meeting_content,
        meeting_result=result.meeting_result,
        minutes_attachment=result.minutes_attachment,
        created_by=CreatedByResponse(name=result.created_by_name, email=result.created_by_email),
        attendees=[AttendeeResponse(id=item.id, name=item.name, email=item.email) for item in result.attendees],
    )


def _to_minutes_lock_response(result: MinutesLockResult) -> MinutesLockResponse:
    return MinutesLockResponse(
        reservation_id=result.reservation_id,
        holder_user_id=result.holder_user_id,
        holder_name=result.holder_name,
        expires_at=result.expires_at,
    )


def _error_status(code: str) -> int:
    if code == "UNAUTHORIZED":
        return status.HTTP_401_UNAUTHORIZED
    if code == "FORBIDDEN":
        return status.HTTP_403_FORBIDDEN
    if code == "INVALID_ARGUMENT":
        return status.HTTP_400_BAD_REQUEST
    if code == "NOT_FOUND":
        return status.HTTP_404_NOT_FOUND
    if code in {"RESERVATION_CONFLICT", "LOCKED"}:
        return status.HTTP_409_CONFLICT
    return status.HTTP_500_INTERNAL_SERVER_ERROR


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
