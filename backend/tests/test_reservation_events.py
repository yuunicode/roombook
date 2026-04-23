import pytest
from fastapi.testclient import TestClient

from app.service.reservation_event_service import ReservationEvent, ReservationEventBroker


def test_should_require_auth_for_reservation_event_stream(client: TestClient) -> None:
    response = client.get("/api/reservations/events")

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "로그인이 필요합니다."


@pytest.mark.asyncio
async def test_should_deliver_published_reservation_event_to_subscriber() -> None:
    broker = ReservationEventBroker()
    subscriber = await broker.subscribe()

    await broker.publish(ReservationEvent(action="created", reservation_id="rsv-1"))

    event = await subscriber.get()
    assert event.action == "created"
    assert event.reservation_id == "rsv-1"

    await broker.unsubscribe(subscriber)
