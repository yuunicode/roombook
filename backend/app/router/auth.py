from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.settings import (
    SESSION_COOKIE_MAX_AGE_SECONDS,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_PATH,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
)
from app.infra.user_schema import AuthUserModel
from app.service.auth_service import authenticate_user, create_session_token, get_user_from_session_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    user: UserResponse


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


@router.post(
    "/login",
    response_model=AuthResponse,
    responses={401: {"model": ErrorResponse}},
)
async def login(payload: LoginRequest, response: Response) -> AuthResponse | JSONResponse:
    # 이메일/비밀번호를 검증하고 성공 시 1년 만료 세션 쿠키를 발급한다.
    user = authenticate_user(payload.email, payload.password)
    if user is None:
        return _unauthorized_response("이메일 또는 비밀번호가 올바르지 않습니다.")

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user.id),
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path=SESSION_COOKIE_PATH,
    )
    return AuthResponse(user=_to_user_response(user))


@router.get(
    "/me",
    response_model=AuthResponse,
    responses={401: {"model": ErrorResponse}},
)
async def get_me(request: Request) -> AuthResponse | JSONResponse:
    # 세션 쿠키를 읽어 현재 로그인 사용자를 반환한다.
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        return _unauthorized_response("로그인이 필요합니다.")

    user = get_user_from_session_token(token)
    if user is None:
        return _unauthorized_response("로그인이 필요합니다.")

    return AuthResponse(user=_to_user_response(user))


def _to_user_response(user: AuthUserModel) -> UserResponse:
    # 서비스 모델을 API 응답 모델로 변환한다.
    return UserResponse(id=user.id, name=user.name, email=user.email)


def _unauthorized_response(message: str) -> JSONResponse:
    # 인증 실패 시 공통 401 에러 응답 포맷을 생성한다.
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={
            "error": {
                "code": "UNAUTHORIZED",
                "message": message,
            }
        },
    )
