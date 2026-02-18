from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    timetable_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(500), nullable=True)
    agenda_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
