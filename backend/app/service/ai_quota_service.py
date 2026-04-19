from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import AI_GLOBAL_MONTHLY_LIMIT_USD
from app.infra.global_ai_quota_repo import find_or_create_global_ai_quota
from app.infra.user_ai_quota_repo import find_or_create_user_ai_quota, list_user_ai_quotas_with_users
from app.service.admin_service import is_admin_user
from app.service.auth_service import AuthUser
from app.service.domain import DomainError

ZERO_USD = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class GlobalAiQuotaStatus:
    monthly_limit_usd: Decimal
    used_usd: Decimal
    remaining_usd: Decimal
    period_month: str


@dataclass(frozen=True, slots=True)
class UserAiUsageSummary:
    user_id: str
    name: str
    email: str
    department: str
    used_usd: Decimal
    period_month: str
    updated_at: datetime | None


@dataclass(frozen=True, slots=True)
class AiUsageOverview:
    summary: GlobalAiQuotaStatus
    items: list[UserAiUsageSummary]


@dataclass(frozen=True, slots=True)
class AppliedAiUsageStatus:
    global_used_usd: Decimal
    global_remaining_usd: Decimal
    user_used_usd: Decimal
    period_month: str


def _period_month_now() -> str:
    return datetime.now().strftime("%Y-%m")


def _to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _default_global_limit_usd() -> Decimal:
    try:
        return _to_money(Decimal(AI_GLOBAL_MONTHLY_LIMIT_USD))
    except Exception:
        return Decimal("10.0000")


def _to_global_status(monthly_limit_usd: Decimal, used_usd: Decimal, period_month: str) -> GlobalAiQuotaStatus:
    limit = _to_money(monthly_limit_usd)
    used = _to_money(used_usd)
    remaining = _to_money(max(ZERO_USD, limit - used))
    return GlobalAiQuotaStatus(
        monthly_limit_usd=limit,
        used_usd=used,
        remaining_usd=remaining,
        period_month=period_month,
    )


async def ensure_quota_available(user_id: str, db: AsyncSession) -> GlobalAiQuotaStatus | DomainError:
    del user_id
    month = _period_month_now()
    quota = await find_or_create_global_ai_quota(
        db=db,
        period_month=month,
        default_limit_usd=_default_global_limit_usd(),
    )
    used_usd = Decimal(str(quota.used_usd)) if quota.period_month == month else ZERO_USD
    status = _to_global_status(
        monthly_limit_usd=Decimal(str(quota.monthly_limit_usd)),
        used_usd=used_usd,
        period_month=month,
    )
    if status.remaining_usd <= ZERO_USD:
        return DomainError(
            code="QUOTA_EXCEEDED",
            message=f"이번 달 전사 AI 사용 한도($ {status.monthly_limit_usd})를 초과했습니다.",
        )
    return status


async def list_ai_usage_summaries_by_admin(
    auth_user: AuthUser,
    db: AsyncSession,
) -> AiUsageOverview | DomainError:
    if not is_admin_user(auth_user):
        return DomainError(code="FORBIDDEN", message="관리자만 AI 사용량을 조회할 수 있습니다.")

    month = _period_month_now()
    global_quota = await find_or_create_global_ai_quota(
        db=db,
        period_month=month,
        default_limit_usd=_default_global_limit_usd(),
    )
    global_used_usd = Decimal(str(global_quota.used_usd)) if global_quota.period_month == month else ZERO_USD
    summary = _to_global_status(
        monthly_limit_usd=Decimal(str(global_quota.monthly_limit_usd)),
        used_usd=global_used_usd,
        period_month=month,
    )

    rows = await list_user_ai_quotas_with_users(db)
    items: list[UserAiUsageSummary] = []
    for (
        user_id,
        name,
        email,
        department,
        _monthly_limit_usd,
        used_usd,
        period_month,
        updated_at,
    ) in rows:
        normalized_used = Decimal(str(used_usd)) if used_usd is not None and period_month == month else ZERO_USD
        items.append(
            UserAiUsageSummary(
                user_id=user_id,
                name=name,
                email=email,
                department=department,
                used_usd=_to_money(normalized_used),
                period_month=month,
                updated_at=updated_at if period_month == month and isinstance(updated_at, datetime) else None,
            )
        )

    return AiUsageOverview(summary=summary, items=items)


async def apply_ai_usage_cost(
    user_id: str,
    usd_cost: Decimal,
    db: AsyncSession,
) -> AppliedAiUsageStatus | DomainError:
    normalized_cost = _to_money(max(ZERO_USD, usd_cost))
    month = _period_month_now()

    try:
        global_quota = await find_or_create_global_ai_quota(
            db=db,
            period_month=month,
            default_limit_usd=_default_global_limit_usd(),
            for_update=True,
        )
        user_quota = await find_or_create_user_ai_quota(
            db=db,
            user_id=user_id,
            period_month=month,
            default_limit_usd=ZERO_USD,
            for_update=True,
        )

        if global_quota.period_month != month:
            global_quota.period_month = month
            global_quota.used_usd = ZERO_USD
        if user_quota.period_month != month:
            user_quota.period_month = month
            user_quota.used_usd = ZERO_USD

        current_global_status = _to_global_status(
            monthly_limit_usd=Decimal(str(global_quota.monthly_limit_usd)),
            used_usd=Decimal(str(global_quota.used_usd)),
            period_month=month,
        )
        if normalized_cost > ZERO_USD and current_global_status.remaining_usd < normalized_cost:
            await db.rollback()
            return DomainError(
                code="QUOTA_EXCEEDED",
                message=f"이번 달 전사 AI 사용 한도($ {current_global_status.monthly_limit_usd})를 초과했습니다.",
            )

        global_quota.used_usd = _to_money(Decimal(str(global_quota.used_usd)) + normalized_cost)
        user_quota.used_usd = _to_money(Decimal(str(user_quota.used_usd)) + normalized_cost)
        await db.commit()

        return AppliedAiUsageStatus(
            global_used_usd=_to_money(Decimal(str(global_quota.used_usd))),
            global_remaining_usd=_to_money(
                max(ZERO_USD, Decimal(str(global_quota.monthly_limit_usd)) - Decimal(str(global_quota.used_usd)))
            ),
            user_used_usd=_to_money(Decimal(str(user_quota.used_usd))),
            period_month=month,
        )
    except Exception:
        await db.rollback()
        raise
