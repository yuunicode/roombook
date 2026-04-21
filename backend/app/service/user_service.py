from dataclasses import dataclass

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user import (
    User,
    add_user,
    count_active_admin_users,
    find_user_by_email_ci,
    find_user_by_id,
    list_users,
    resolve_user_ids_by_ids_or_emails,
    search_users_by_query,
)
from app.service.admin_service import is_admin_user
from app.service.auth_service import AuthUser, hash_password
from app.service.domain import DomainError

DEFAULT_NEW_USER_PASSWORD = "ecminer"
DEFAULT_EMAIL_DOMAIN = "ecminer.com"
ALLOWED_DEPARTMENTS = ("컨설팅", "R&D센터", "사업본부")


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
    is_admin: bool


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
        CreatedUser(id=user_id, name=name, email=email, department=department, is_admin=is_admin)
        for user_id, name, email, department, is_admin in rows
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
    payload_department: str,
    auth_user: AuthUser,
    db: AsyncSession,
) -> CreatedUser | DomainError:
    normalized_id = payload_id.strip()
    normalized_name = payload_name.strip()
    normalized_email = f"{normalized_id.lower()}@{DEFAULT_EMAIL_DOMAIN}"
    normalized_department = payload_department.strip()

    if not normalized_id or not normalized_name or not normalized_department:
        return DomainError(
            code="INVALID_ARGUMENT",
            message="id, name, department는 비어 있을 수 없습니다.",
        )
    if normalized_department not in ALLOWED_DEPARTMENTS:
        return DomainError(
            code="INVALID_ARGUMENT",
            message="department는 컨설팅, R&D센터, 사업본부 중 하나여야 합니다.",
        )

    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 사용자 계정을 생성할 수 있습니다.")

    duplicated_id_user = await find_user_by_id(db, normalized_id, include_inactive=True)
    if duplicated_id_user is not None:
        return DomainError(code="USER_ALREADY_EXISTS", message="동일한 id를 가진 사용자가 이미 존재합니다.")

    duplicated_email_user = await find_user_by_email_ci(db, normalized_email, include_inactive=True)
    if duplicated_email_user is not None:
        return DomainError(code="USER_ALREADY_EXISTS", message="동일한 email을 가진 사용자가 이미 존재합니다.")

    add_user(
        db,
        User(
            id=normalized_id,
            name=normalized_name,
            email=normalized_email,
            department=normalized_department,
            is_admin=False,
            password_hash=hash_password(DEFAULT_NEW_USER_PASSWORD),
        ),
    )
    await db.commit()
    return CreatedUser(
        id=normalized_id,
        name=normalized_name,
        email=normalized_email,
        department=normalized_department,
        is_admin=False,
    )


async def set_user_admin(
    target_user_id: str,
    is_admin: bool,
    auth_user: AuthUser,
    db: AsyncSession,
) -> CreatedUser | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 권한을 변경할 수 있습니다.")

    target = await find_user_by_id(db, target_user_id)
    if target is None:
        return DomainError(code="NOT_FOUND", message="사용자를 찾을 수 없습니다.")
    if target.is_admin and not is_admin:
        active_admin_count = await count_active_admin_users(db)
        if active_admin_count <= 1:
            return DomainError(code="CONFLICT", message="관리자는 최소 1명 이상이어야 합니다.")

    target.is_admin = is_admin
    await db.commit()
    return CreatedUser(
        id=target.id,
        name=target.name,
        email=target.email,
        department=target.department,
        is_admin=target.is_admin,
    )


async def delete_user_by_admin(
    target_user_id: str,
    auth_user: AuthUser,
    db: AsyncSession,
) -> None | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 사용자를 삭제할 수 있습니다.")

    if target_user_id == auth_user.id:
        return DomainError(code="INVALID_ARGUMENT", message="본인 계정은 삭제할 수 없습니다.")

    target = await find_user_by_id(db, target_user_id)
    if target is None:
        return DomainError(code="NOT_FOUND", message="사용자를 찾을 수 없습니다.")

    if not target.is_active:
        return DomainError(code="NOT_FOUND", message="사용자를 찾을 수 없습니다.")
    if target.is_admin:
        active_admin_count = await count_active_admin_users(db)
        if active_admin_count <= 1:
            return DomainError(code="CONFLICT", message="관리자는 최소 1명 이상이어야 합니다.")

    target.is_active = False
    target.is_admin = False
    try:
        await db.commit()
    except SQLAlchemyError:
        await db.rollback()
        return DomainError(code="CONFLICT", message="사용자를 비활성화할 수 없습니다. 잠시 후 다시 시도해 주세요.")

    return None
