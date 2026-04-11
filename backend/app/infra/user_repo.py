from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user import User


def add_user(db: AsyncSession, user: User) -> None:
    db.add(user)


async def find_user_by_id(
    db: AsyncSession,
    user_id: str,
    *,
    include_inactive: bool = False,
) -> User | None:
    query = select(User).where(User.id == user_id)
    if not include_inactive:
        query = query.where(User.is_active.is_(True))
    row = await db.execute(query)
    return row.scalar_one_or_none()


async def find_user_by_email_ci(
    db: AsyncSession,
    email: str,
    *,
    include_inactive: bool = False,
) -> User | None:
    normalized_email = email.strip().lower()
    query = select(User).where(func.lower(User.email) == normalized_email)
    if not include_inactive:
        query = query.where(User.is_active.is_(True))
    row = await db.execute(query)
    return row.scalar_one_or_none()


async def search_users_by_query(db: AsyncSession, q: str, limit: int) -> list[tuple[str, str, str]]:
    pattern = f"%{q.strip().lower()}%"
    rows = await db.execute(
        select(User.id, User.name, User.email)
        .where(
            User.is_active.is_(True),
            (func.lower(User.name).like(pattern)) | (func.lower(User.email).like(pattern)),
        )
        .order_by(User.name.asc())
        .limit(limit)
    )
    return list(rows.tuples().all())


async def list_users(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
) -> list[tuple[str, str, str, str, bool]]:
    query = select(User.id, User.name, User.email, User.department, User.is_admin)
    if not include_inactive:
        query = query.where(User.is_active.is_(True))
    rows = await db.execute(query.order_by(User.name.asc()))
    return list(rows.tuples().all())


async def resolve_user_ids_by_ids_or_emails(db: AsyncSession, identifiers: list[str]) -> dict[str, str]:
    if not identifiers:
        return {}

    rows = await db.execute(
        select(User.id, User.email).where(
            User.is_active.is_(True),
            (User.id.in_(identifiers)) | (User.email.in_(identifiers)),
        )
    )
    resolved: dict[str, str] = {}
    for user_id, email in rows.tuples().all():
        resolved[user_id] = user_id
        resolved[email] = user_id
    return resolved
