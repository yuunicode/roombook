ROOM_NAME_MAP: dict[str, str] = {
    "A": "대회의실",
    "B": "테이블",
}


def resolve_room_name(room_id: str) -> str:
    return ROOM_NAME_MAP.get(room_id, room_id)
