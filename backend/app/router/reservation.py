from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.domain import DomainError
from app.service.reservation_service import (
    CreateReservationInput,
    ReservationDetailResult,
    UpdateReservationInput,
    create_reservation,
    delete_reservation,
    get_reservation_detail,
    update_reservation,
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
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
            attendees=payload.attendees,
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
        purpose=result.purpose,
        agenda_url=result.agenda_url,
        start_at=result.start_at,
        end_at=result.end_at,
        created_at=result.created_at,
    )


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
            purpose=payload.purpose,
            agenda_url=payload.agenda_url,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
            attendees=payload.attendees,
        ),
        auth_user_id=auth_user.id,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)

    return _to_reservation_detail_response(result)


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
        purpose=result.purpose,
        agenda_url=result.agenda_url,
        start_at=result.start_at,
        end_at=result.end_at,
        description=result.description,
        created_by=CreatedByResponse(name=result.created_by_name),
        attendees=[AttendeeResponse(id=item.id, name=item.name, email=item.email) for item in result.attendees],
    )


def _error_status(code: str) -> int:
    if code == "UNAUTHORIZED":
        return status.HTTP_401_UNAUTHORIZED
    if code == "INVALID_ARGUMENT":
        return status.HTTP_400_BAD_REQUEST
    if code == "NOT_FOUND":
        return status.HTTP_404_NOT_FOUND
    if code == "RESERVATION_CONFLICT":
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
