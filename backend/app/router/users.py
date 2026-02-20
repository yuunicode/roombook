from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import get_user_from_session_token
from app.service.domain import DomainError
from app.service.user_service import search_users as search_users_service

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


def _unauthorized_response() -> JSONResponse:
    return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")


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
