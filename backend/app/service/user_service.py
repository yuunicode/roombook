from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user import User
from app.infra.user_repo import (
    add_user,
    find_user_by_email_ci,
    find_user_by_id,
    list_users,
    resolve_user_ids_by_ids_or_emails,
    search_users_by_query,
)
from app.service.admin_service import is_admin_user
from app.service.auth_service import AuthUser, hash_password
from app.service.domain import DomainError


@dataclass(frozen=True, slots=True)
class UserSearchItem:
    id: str
    name: str
    email: str


@dataclass(frozen=True, slots=True)
class CreatedUser:
    id: str
    name: str
    email: str
    department: str


async def search_users(
    q: str,
    limit: int,
    auth_user_id: str,
    db: AsyncSession,
) -> list[UserSearchItem] | DomainError:
    del auth_user_id
    normalized_q = q.strip()
    if not normalized_q:
        return DomainError(code="INVALID_ARGUMENT", message="q는 비어 있을 수 없습니다.")

    rows = await search_users_by_query(db, normalized_q, limit)
    return [UserSearchItem(id=user_id, name=name, email=email) for user_id, name, email in rows]


async def list_all_users(
    auth_user_id: str,
    db: AsyncSession,
) -> list[CreatedUser] | DomainError:
    del auth_user_id
    rows = await list_users(db)
    return [
        CreatedUser(id=user_id, name=name, email=email, department=department)
        for user_id, name, email, department in rows
    ]


async def resolve_attendee_user_ids(
    attendees: list[str] | None,
    db: AsyncSession,
) -> list[str] | DomainError:
    if attendees is None:
        return []

    cleaned = list(dict.fromkeys(item.strip() for item in attendees if item.strip()))
    if not cleaned:
        return []

    resolved = await resolve_user_ids_by_ids_or_emails(db, cleaned)
    try:
        return [resolved[item] for item in cleaned]
    except KeyError:
        return DomainError(
            code="INVALID_ARGUMENT",
            message="attendees에 존재하지 않는 사용자가 포함되어 있습니다.",
        )


async def create_user_by_admin(
    payload_id: str,
    payload_name: str,
    payload_email: str,
    payload_department: str,
    payload_password: str,
    auth_user: AuthUser,
    db: AsyncSession,
) -> CreatedUser | DomainError:
    normalized_id = payload_id.strip()
    normalized_name = payload_name.strip()
    normalized_email = payload_email.strip().lower()
    normalized_department = payload_department.strip()
    raw_password = payload_password.strip()

    if (
        not normalized_id
        or not normalized_name
        or not normalized_email
        or not normalized_department
        or not raw_password
    ):
        return DomainError(
            code="INVALID_ARGUMENT",
            message="id, name, email, department, password는 비어 있을 수 없습니다.",
        )

    if not is_admin_user(auth_user.id, auth_user.email):
        return DomainError(code="FORBIDDEN", message="관리자만 사용자 계정을 생성할 수 있습니다.")

    duplicated_id_user = await find_user_by_id(db, normalized_id)
    if duplicated_id_user is not None:
        return DomainError(code="USER_ALREADY_EXISTS", message="동일한 id를 가진 사용자가 이미 존재합니다.")

    duplicated_email_user = await find_user_by_email_ci(db, normalized_email)
    if duplicated_email_user is not None:
        return DomainError(code="USER_ALREADY_EXISTS", message="동일한 email을 가진 사용자가 이미 존재합니다.")

    add_user(
        db,
        User(
            id=normalized_id,
            name=normalized_name,
            email=normalized_email,
            department=normalized_department,
            password_hash=hash_password(raw_password),
        ),
    )
    await db.commit()
    return CreatedUser(
        id=normalized_id,
        name=normalized_name,
        email=normalized_email,
        department=normalized_department,
    )
