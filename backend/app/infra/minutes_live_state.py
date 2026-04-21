from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func, select
from sqlalchemy.ext.asyncio import AsyncSession
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


async def find_minutes_live_state(db: AsyncSession, reservation_id: str) -> MinutesLiveState | None:
    row = await db.execute(select(MinutesLiveState).where(MinutesLiveState.reservation_id == reservation_id))
    return row.scalar_one_or_none()


async def add_or_update_minutes_live_state(
    db: AsyncSession,
    reservation_id: str,
    transcript_text: str,
    is_recording: bool,
    updated_by_user_id: str | None,
    updated_by_name: str | None,
) -> MinutesLiveState:
    state = await find_minutes_live_state(db, reservation_id)
    if state is None:
        state = MinutesLiveState(
            reservation_id=reservation_id,
            transcript_text=transcript_text,
            is_recording=is_recording,
            updated_by_user_id=updated_by_user_id,
            updated_by_name=updated_by_name,
        )
        db.add(state)
        return state

    state.transcript_text = transcript_text
    state.is_recording = is_recording
    state.updated_by_user_id = updated_by_user_id
    state.updated_by_name = updated_by_name
    return state
