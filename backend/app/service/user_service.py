from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user_repo import resolve_user_ids_by_ids_or_emails, search_users_by_query
from app.service.domain import DomainError


@dataclass(frozen=True, slots=True)
class UserSearchItem:
    id: str
    name: str
    email: str


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
