from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db import Base


class Timetable(Base):
    __tablename__ = "timetables"
    __table_args__ = (
        UniqueConstraint("room_id", "start_at", "end_at", name="uq_timetables_room_time"),
        CheckConstraint("end_at > start_at", name="ck_timetables_end_after_start"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    room_id: Mapped[str] = mapped_column(String(50), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
