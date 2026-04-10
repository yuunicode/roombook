from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.room_service import list_all_rooms

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class RoomResponse(BaseModel):
    id: str
    name: str
    capacity: int


@router.get("", response_model=list[RoomResponse], responses={401: {"model": ErrorResponse}})
async def get_rooms(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[RoomResponse] | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    rows = await list_all_rooms(db)
    return [RoomResponse(id=item.id, name=item.name, capacity=item.capacity) for item in rows]


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


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
