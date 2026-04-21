from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class GlobalAiQuota(Base):
    __tablename__ = "global_ai_quotas"

    quota_key: Mapped[str] = mapped_column(String(20), primary_key=True)
    monthly_limit_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        nullable=False,
        default=Decimal("5.0000"),
        server_default="5.0000",
    )
    used_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 6),
        nullable=False,
        default=Decimal("0.000000"),
        server_default="0.000000",
    )
    period_month: Mapped[str] = mapped_column(String(7), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


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
