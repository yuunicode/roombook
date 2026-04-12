from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.minutes_live_state import MinutesLiveState


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
