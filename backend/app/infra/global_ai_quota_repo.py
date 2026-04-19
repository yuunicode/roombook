from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.global_ai_quota import GlobalAiQuota

GLOBAL_AI_QUOTA_KEY = "global"


async def find_global_ai_quota(
    db: AsyncSession,
    *,
    for_update: bool = False,
) -> GlobalAiQuota | None:
    query = select(GlobalAiQuota).where(GlobalAiQuota.quota_key == GLOBAL_AI_QUOTA_KEY)
    if for_update:
        query = query.with_for_update()
    row = await db.execute(query)
    return row.scalar_one_or_none()


async def find_or_create_global_ai_quota(
    db: AsyncSession,
    period_month: str,
    default_limit_usd: Decimal,
    *,
    for_update: bool = False,
) -> GlobalAiQuota:
    quota = await find_global_ai_quota(db, for_update=for_update)
    if quota is not None:
        return quota

    quota = GlobalAiQuota(
        quota_key=GLOBAL_AI_QUOTA_KEY,
        monthly_limit_usd=default_limit_usd,
        used_usd=Decimal("0.0000"),
        period_month=period_month,
    )
    db.add(quota)
    await db.flush()
    return quota
