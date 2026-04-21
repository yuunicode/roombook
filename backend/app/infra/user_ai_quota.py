from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base
from app.infra.user import User


class UserAiQuota(Base):
    __tablename__ = "user_ai_quotas"

    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    monthly_limit_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        nullable=False,
        default=Decimal("1.0000"),
        server_default="1.0000",
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
