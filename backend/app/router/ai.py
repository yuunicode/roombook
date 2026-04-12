import asyncio

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import SESSION_COOKIE_NAME
from app.infra.db import get_db_session
from app.service.ai_quota_service import apply_ai_usage_cost, ensure_quota_available
from app.service.ai_service import suggest_minutes_bullets, transcribe_audio_chunk
from app.service.auth_service import AuthUser, get_user_from_session_token
from app.service.domain import DomainError

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class TranscribeChunkRequest(BaseModel):
    audio_base64: str
    mime_type: str | None = None
    previous_text: str | None = None


class TranscribeChunkResponse(BaseModel):
    text: str
    used_usd: float
    remaining_usd: float


class SuggestMinutesRequest(BaseModel):
    transcript: str
    existing_agenda: str | None = None
    existing_meeting_content: str | None = None
    existing_meeting_result: str | None = None


class SuggestMinutesResponse(BaseModel):
    agenda: list[str]
    meeting_content: list[str]
    meeting_result: list[str]
    used_usd: float
    remaining_usd: float


@router.post(
    "/transcribe-chunk",
    response_model=TranscribeChunkResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def transcribe_chunk_api(
    payload: TranscribeChunkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> TranscribeChunkResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    quota = await ensure_quota_available(auth_user.id, db)
    if isinstance(quota, DomainError):
        return _error_response(_error_status(quota.code), quota.code, quota.message)

    result = await asyncio.to_thread(
        transcribe_audio_chunk,
        payload.audio_base64,
        payload.mime_type,
        payload.previous_text,
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)
    applied = await apply_ai_usage_cost(auth_user.id, result.usd_cost, db)
    return TranscribeChunkResponse(
        text=result.text,
        used_usd=float(applied.used_usd),
        remaining_usd=float(applied.remaining_usd),
    )


@router.post(
    "/suggest-minutes",
    response_model=SuggestMinutesResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def suggest_minutes_api(
    payload: SuggestMinutesRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SuggestMinutesResponse | JSONResponse:
    auth_user = await _require_auth_user(request, db)
    if auth_user is None:
        return _error_response(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.")

    quota = await ensure_quota_available(auth_user.id, db)
    if isinstance(quota, DomainError):
        return _error_response(_error_status(quota.code), quota.code, quota.message)

    result = await asyncio.to_thread(
        suggest_minutes_bullets,
        payload.transcript,
        payload.existing_agenda or "",
        payload.existing_meeting_content or "",
        payload.existing_meeting_result or "",
    )
    if isinstance(result, DomainError):
        return _error_response(_error_status(result.code), result.code, result.message)
    applied = await apply_ai_usage_cost(auth_user.id, result.usd_cost, db)
    return SuggestMinutesResponse(
        agenda=result.agenda,
        meeting_content=result.meeting_content,
        meeting_result=result.meeting_result,
        used_usd=float(applied.used_usd),
        remaining_usd=float(applied.remaining_usd),
    )


async def _require_auth_user(request: Request, db: AsyncSession) -> AuthUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return None
    return await get_user_from_session_token(token, db)


def _error_status(code: str) -> int:
    if code == "UNAUTHORIZED":
        return status.HTTP_401_UNAUTHORIZED
    if code == "INVALID_ARGUMENT":
        return status.HTTP_400_BAD_REQUEST
    if code == "QUOTA_EXCEEDED":
        return status.HTTP_429_TOO_MANY_REQUESTS
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
