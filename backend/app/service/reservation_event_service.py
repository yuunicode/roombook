import asyncio
from dataclasses import dataclass
from typing import Literal

ReservationEventAction = Literal["created", "updated", "deleted"]


@dataclass(frozen=True, slots=True)
class ReservationEvent:
    action: ReservationEventAction
    reservation_id: str


class ReservationEventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[ReservationEvent]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[ReservationEvent]:
        queue: asyncio.Queue[ReservationEvent] = asyncio.Queue(maxsize=10)
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[ReservationEvent]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, event: ReservationEvent) -> None:
        async with self._lock:
            subscribers = tuple(self._subscribers)

        for queue in subscribers:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    continue
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                continue


reservation_event_broker = ReservationEventBroker()
