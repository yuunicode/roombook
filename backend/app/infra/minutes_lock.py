from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class MinutesLock(Base):
    __tablename__ = "minutes_locks"

    reservation_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    holder_user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    holder_name: Mapped[str] = mapped_column(String(100), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
