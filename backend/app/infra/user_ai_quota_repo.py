from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user_ai_quota import UserAiQuota


async def find_user_ai_quota(db: AsyncSession, user_id: str) -> UserAiQuota | None:
    row = await db.execute(select(UserAiQuota).where(UserAiQuota.user_id == user_id))
    return row.scalar_one_or_none()


async def find_or_create_user_ai_quota(
    db: AsyncSession,
    user_id: str,
    period_month: str,
    default_limit_usd: Decimal,
) -> UserAiQuota:
    quota = await find_user_ai_quota(db, user_id)
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
