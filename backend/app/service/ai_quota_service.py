from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.user_ai_quota_repo import find_or_create_user_ai_quota
from app.service.domain import DomainError

DEFAULT_MONTHLY_LIMIT_USD = Decimal("1.0000")
ZERO_USD = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class UserAiQuotaStatus:
    user_id: str
    monthly_limit_usd: Decimal
    used_usd: Decimal
    remaining_usd: Decimal
    period_month: str


def _period_month_now() -> str:
    return datetime.now().strftime("%Y-%m")


def _to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _to_status(user_id: str, monthly_limit_usd: Decimal, used_usd: Decimal, period_month: str) -> UserAiQuotaStatus:
    limit = _to_money(monthly_limit_usd)
    used = _to_money(used_usd)
    remaining = _to_money(max(ZERO_USD, limit - used))
    return UserAiQuotaStatus(
        user_id=user_id,
        monthly_limit_usd=limit,
        used_usd=used,
        remaining_usd=remaining,
        period_month=period_month,
    )


async def get_or_reset_user_quota(user_id: str, db: AsyncSession) -> UserAiQuotaStatus:
    month = _period_month_now()
    quota = await find_or_create_user_ai_quota(
        db=db,
        user_id=user_id,
        period_month=month,
        default_limit_usd=DEFAULT_MONTHLY_LIMIT_USD,
    )
    if quota.period_month != month:
        quota.period_month = month
        quota.used_usd = ZERO_USD
        await db.commit()
    return _to_status(
        user_id=quota.user_id,
        monthly_limit_usd=Decimal(str(quota.monthly_limit_usd)),
        used_usd=Decimal(str(quota.used_usd)),
        period_month=quota.period_month,
    )


async def ensure_quota_available(user_id: str, db: AsyncSession) -> UserAiQuotaStatus | DomainError:
    status = await get_or_reset_user_quota(user_id, db)
    if status.remaining_usd <= ZERO_USD:
        return DomainError(
            code="QUOTA_EXCEEDED",
            message=f"이번 달 AI 사용 한도($ {status.monthly_limit_usd})를 초과했습니다.",
        )
    return status


async def apply_ai_usage_cost(user_id: str, usd_cost: Decimal, db: AsyncSession) -> UserAiQuotaStatus:
    normalized_cost = _to_money(max(ZERO_USD, usd_cost))
    month = _period_month_now()
    quota = await find_or_create_user_ai_quota(
        db=db,
        user_id=user_id,
        period_month=month,
        default_limit_usd=DEFAULT_MONTHLY_LIMIT_USD,
    )
    if quota.period_month != month:
        quota.period_month = month
        quota.used_usd = ZERO_USD
    quota.used_usd = _to_money(Decimal(str(quota.used_usd)) + normalized_cost)
    await db.commit()
    return _to_status(
        user_id=quota.user_id,
        monthly_limit_usd=Decimal(str(quota.monthly_limit_usd)),
        used_usd=Decimal(str(quota.used_usd)),
        period_month=quota.period_month,
    )
