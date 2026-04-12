from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class MinutesLiveState(Base):
    __tablename__ = "minutes_live_states"

    reservation_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    transcript_text: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    is_recording: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    updated_by_user_id: Mapped[str | None] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
