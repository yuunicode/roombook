from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.domain import DomainError
from app.service.reservation_label_service import (
    create_label,
    list_labels,
    remove_label,
    set_label_visibility,
    update_label,
)

router = APIRouter(prefix="/api/labels", tags=["labels"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class LabelResponse(BaseModel):
    name: str
    is_hidden: bool


class CreateLabelRequest(BaseModel):
    name: str


class UpdateLabelRequest(BaseModel):
    name: str


class UpdateLabelVisibilityRequest(BaseModel):
    is_hidden: bool


class OkResponse(BaseModel):
    ok: bool


@router.get("", response_model=list[LabelResponse], responses={401: {"model": ErrorResponse}})
async def get_labels(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[LabelResponse] | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    rows = await list_labels(db)
    return [LabelResponse(name=item.name, is_hidden=item.is_hidden) for item in rows]


@router.post(
    "",
    response_model=LabelResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def create_label_api(
    payload: CreateLabelRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> LabelResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await create_label(payload.name, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_status(result.code), result.code, result.message)
    return LabelResponse(name=result.name, is_hidden=result.is_hidden)


@router.patch(
    "/{label_name}/visibility",
    response_model=LabelResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def update_label_visibility_api(
    label_name: str,
    payload: UpdateLabelVisibilityRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> LabelResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await set_label_visibility(label_name, payload.is_hidden, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_status(result.code), result.code, result.message)
    return LabelResponse(name=result.name, is_hidden=result.is_hidden)


@router.patch(
    "/{label_name}",
    response_model=LabelResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def update_label_api(
    label_name: str,
    payload: UpdateLabelRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> LabelResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await update_label(label_name, payload.name, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_status(result.code), result.code, result.message)
    return LabelResponse(name=result.name, is_hidden=result.is_hidden)


@router.delete(
    "/{label_name}",
    status_code=status.HTTP_200_OK,
    response_model=OkResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def delete_label_api(
    label_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OkResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    result = await remove_label(label_name, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_status(result.code), result.code, result.message)
    return OkResponse(ok=True)


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


def _status(code: str) -> int:
    if code == "FORBIDDEN":
        return status.HTTP_403_FORBIDDEN
    if code == "NOT_FOUND":
        return status.HTTP_404_NOT_FOUND
    if code == "CONFLICT":
        return status.HTTP_409_CONFLICT
    return status.HTTP_400_BAD_REQUEST


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
