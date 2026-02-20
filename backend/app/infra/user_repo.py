from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user import User


async def find_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    row = await db.execute(select(User).where(User.id == user_id))
    return row.scalar_one_or_none()


async def find_user_by_email_ci(db: AsyncSession, email: str) -> User | None:
    normalized_email = email.strip().lower()
    row = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    return row.scalar_one_or_none()


async def search_users_by_query(db: AsyncSession, q: str, limit: int) -> list[tuple[str, str, str]]:
    pattern = f"%{q.strip().lower()}%"
    rows = await db.execute(
        select(User.id, User.name, User.email)
        .where((func.lower(User.name).like(pattern)) | (func.lower(User.email).like(pattern)))
        .order_by(User.name.asc())
        .limit(limit)
    )
    return list(rows.tuples().all())


async def resolve_user_ids_by_ids_or_emails(db: AsyncSession, identifiers: list[str]) -> dict[str, str]:
    if not identifiers:
        return {}

    rows = await db.execute(
        select(User.id, User.email).where((User.id.in_(identifiers)) | (User.email.in_(identifiers)))
    )
    resolved: dict[str, str] = {}
    for user_id, email in rows.tuples().all():
        resolved[user_id] = user_id
        resolved[email] = user_id
    return resolved
