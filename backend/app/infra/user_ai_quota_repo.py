from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user import User
from app.infra.user_ai_quota import UserAiQuota


async def find_user_ai_quota(db: AsyncSession, user_id: str) -> UserAiQuota | None:
    row = await db.execute(select(UserAiQuota).where(UserAiQuota.user_id == user_id))
    return row.scalar_one_or_none()


async def find_user_ai_quota_for_update(db: AsyncSession, user_id: str) -> UserAiQuota | None:
    row = await db.execute(select(UserAiQuota).where(UserAiQuota.user_id == user_id).with_for_update())
    return row.scalar_one_or_none()


async def find_or_create_user_ai_quota(
    db: AsyncSession,
    user_id: str,
    period_month: str,
    default_limit_usd: Decimal,
    *,
    for_update: bool = False,
) -> UserAiQuota:
    quota = await find_user_ai_quota_for_update(db, user_id) if for_update else await find_user_ai_quota(db, user_id)
    if quota is not None:
        return quota

    quota = UserAiQuota(
        user_id=user_id,
        monthly_limit_usd=default_limit_usd,
        used_usd=Decimal("0.0000"),
        period_month=period_month,
    )
    db.add(quota)
    await db.flush()
    return quota


async def list_user_ai_quotas_with_users(
    db: AsyncSession,
) -> list[tuple[str, str, str, str, Decimal | None, Decimal | None, str | None, object | None]]:
    rows = await db.execute(
        select(
            User.id,
            User.name,
            User.email,
            User.department,
            UserAiQuota.monthly_limit_usd,
            UserAiQuota.used_usd,
            UserAiQuota.period_month,
            UserAiQuota.updated_at,
        )
        .select_from(User)
        .outerjoin(UserAiQuota, UserAiQuota.user_id == User.id)
        .where(User.is_active.is_(True))
        .order_by(User.name.asc())
    )
    return list(rows.tuples().all())


async def sum_user_ai_usage_by_period(db: AsyncSession, period_month: str) -> Decimal:
    total = await db.scalar(
        select(func.coalesce(func.sum(UserAiQuota.used_usd), 0)).where(UserAiQuota.period_month == period_month)
    )
    return Decimal(str(total or 0))
