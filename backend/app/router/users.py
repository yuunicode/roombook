from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.domain import DomainError
from app.service.user_service import (
    create_user_by_admin,
    delete_user_by_admin,
    list_all_users,
    set_user_admin,
)
from app.service.user_service import (
    search_users as search_users_service,
)

router = APIRouter(prefix="/api/users", tags=["users"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class UserSearchItem(BaseModel):
    id: str
    name: str
    email: str


class CreateUserRequest(BaseModel):
    id: str
    name: str
    department: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    department: str
    is_admin: bool


class CreateUserResponse(BaseModel):
    id: str
    name: str
    email: str
    department: str
    is_admin: bool


class SetAdminRequest(BaseModel):
    is_admin: bool


class OkResponse(BaseModel):
    ok: bool


@router.get(
    "",
    response_model=list[UserResponse],
    responses={401: {"model": ErrorResponse}},
)
async def get_users(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[UserResponse] | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _unauthorized_response()

    result = await list_all_users(auth_user.id, db)
    if isinstance(result, DomainError):
        return _error_response(status.HTTP_400_BAD_REQUEST, result.code, result.message)

    return [
        UserResponse(
            id=item.id,
            name=item.name,
            email=item.email,
            department=item.department,
            is_admin=item.is_admin,
        )
        for item in result
    ]


@router.get(
    "/search",
    response_model=list[UserSearchItem],
    responses={401: {"model": ErrorResponse}},
)
async def search_users(
    request: Request,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserSearchItem] | JSONResponse:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return _unauthorized_response()

    auth_user = await get_user_from_session_token(token, db)
    if auth_user is None:
        return _unauthorized_response()

    result = await search_users_service(
        q=q,
        limit=limit,
        auth_user_id=auth_user.id,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(status.HTTP_400_BAD_REQUEST, result.code, result.message)

    return [UserSearchItem(id=item.id, name=item.name, email=item.email) for item in result]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateUserResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def create_user(
    payload: CreateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> CreateUserResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _unauthorized_response()

    result = await create_user_by_admin(
        payload_id=payload.id,
        payload_name=payload.name,
        payload_department=payload.department,
        auth_user=auth_user,
        db=db,
    )
    if isinstance(result, DomainError):
        return _error_response(_domain_error_to_status(result.code), result.code, result.message)

    return CreateUserResponse(
        id=result.id,
        name=result.name,
        email=result.email,
        department=result.department,
        is_admin=result.is_admin,
    )


@router.patch(
    "/{user_id}/admin",
    response_model=UserResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def set_admin(
    user_id: str,
    payload: SetAdminRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> UserResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _unauthorized_response()

    result = await set_user_admin(user_id, payload.is_admin, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_domain_error_to_status(result.code), result.code, result.message)

    return UserResponse(
        id=result.id,
        name=result.name,
        email=result.email,
        department=result.department,
        is_admin=result.is_admin,
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=OkResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
async def delete_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> OkResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _unauthorized_response()

    result = await delete_user_by_admin(user_id, auth_user, db)
    if isinstance(result, DomainError):
        return _error_response(_domain_error_to_status(result.code), result.code, result.message)

    return OkResponse(ok=True)


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


def _unauthorized_response() -> JSONResponse:
    return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")


def _domain_error_to_status(code: str) -> int:
    if code == "FORBIDDEN":
        return status.HTTP_403_FORBIDDEN
    if code == "USER_ALREADY_EXISTS":
        return status.HTTP_409_CONFLICT
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
