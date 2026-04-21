from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
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
