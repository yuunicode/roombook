from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.room_repo import list_rooms


@dataclass(frozen=True, slots=True)
class RoomItem:
    id: str
    name: str
    capacity: int


async def list_all_rooms(db: AsyncSession) -> list[RoomItem]:
    rooms = await list_rooms(db)
    return [RoomItem(id=room.id, name=room.name, capacity=room.capacity) for room in rooms]
