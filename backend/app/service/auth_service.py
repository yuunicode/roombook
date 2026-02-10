from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime

from app.core.settings import SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_SIGNING_SECRET
from app.infra.user_model import AuthUserModel, UserModel

USERS_TABLE = (
    UserModel(
        id="1",
        name="관리자",
        email="admin@ecminer.com",
        password="ecminer",
    ),
)

def authenticate_user(email: str, password: str) -> AuthUserModel | None:
    # 이메일로 사용자를 찾고 비밀번호가 일치하면 인증된 사용자 정보를 반환한다.
    user = _find_user_by_email(email)
    if user is None:
        return None

    if not hmac.compare_digest(user.password, password):
        return None

    return AuthUserModel(id=user.id, name=user.name, email=user.email)


def create_session_token(user_id: str) -> str:
    # user_id와 만료시각을 서명해 위변조를 막는 세션 토큰을 만든다.
    expires_at = _now_unix() + SESSION_COOKIE_MAX_AGE_SECONDS
    payload = f"{user_id}:{expires_at}"
    signature = _sign(payload)
    return f"{payload}:{signature}"


def get_user_from_session_token(token: str) -> AuthUserModel | None:
    # 세션 토큰을 검증하고 유효하면 사용자 정보를 반환한다.
    parsed_user_id = _verify_session_token(token)
    if parsed_user_id is None:
        return None

    user = _find_user_by_id(parsed_user_id)
    if user is None:
        return None

    return AuthUserModel(id=user.id, name=user.name, email=user.email)


def _verify_session_token(token: str) -> str | None:
    # 토큰 구조/서명/만료시간을 확인하고 통과하면 user_id를 반환한다.
    parts = token.split(":")
    if len(parts) != 3:
        return None

    user_id, expires_at_str, signature = parts
    payload = f"{user_id}:{expires_at_str}"
    expected_signature = _sign(payload)

    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        expires_at = int(expires_at_str)
    except ValueError:
        return None

    if expires_at < _now_unix():
        return None

    return user_id


def _sign(payload: str) -> str:
    # 서버 비밀키로 payload를 HMAC-SHA256 서명한다.
    return hmac.new(
        SESSION_SIGNING_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _find_user_by_email(email: str) -> UserModel | None:
    # 이메일 정규화 후 users 목록에서 일치하는 사용자를 찾는다.
    normalized_email = email.strip().lower()
    for user in USERS_TABLE:
        if user.email.lower() == normalized_email:
            return user
    return None


def _find_user_by_id(user_id: str) -> UserModel | None:
    # user_id로 users 목록에서 사용자를 찾는다.
    for user in USERS_TABLE:
        if user.id == user_id:
            return user
    return None


def _now_unix() -> int:
    # 현재 UTC 시각을 유닉스 타임스탬프로 반환한다.
    return int(datetime.now(UTC).timestamp())
