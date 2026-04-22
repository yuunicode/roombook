from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def _create_reservation(
    client: TestClient,
    *,
    attendees: list[str] | None = None,
) -> str:
    create_response = client.post(
        "/api/reservations",
        json={
            "room_id": "A",
            "title": "킥오프",
            "purpose": "주간 목표 정렬",
            "agenda_url": "https://example.com/agenda/1",
            "start_at": "2026-03-01T10:00:00+09:00",
            "end_at": "2026-03-01T11:00:00+09:00",
            "attendees": attendees,
        },
    )
    assert create_response.status_code == 201
    return create_response.json()["id"]


def test_should_create_and_return_attendees_in_reservation_detail(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")

    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    detail_response = client.get(f"/api/reservations/{reservation_id}")
    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert payload["purpose"] == "주간 목표 정렬"
    assert payload["agenda_url"] == "https://example.com/agenda/1"
    assert payload["room_name"] == "회의실"
    assert len(payload["attendees"]) == 1
    assert payload["attendees"][0]["email"] == "user@ecminer.com"


def test_should_return_404_when_accessing_other_users_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client)

    _login(client, "user@ecminer.com", "ecminer2")
    response = client.get(f"/api/reservations/{reservation_id}")
    assert response.status_code == 404


def test_should_allow_internal_attendee_to_update_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "user@ecminer.com", "ecminer2")
    response = client.patch(
        f"/api/reservations/{reservation_id}",
        json={
            "title": "내부 참석자 수정",
            "start_at": "2026-03-01T10:00:00+09:00",
            "end_at": "2026-03-01T11:00:00+09:00",
        },
    )

    assert response.status_code == 200
    assert response.json()["title"] == "내부 참석자 수정"


def test_should_return_403_when_non_attendee_updates_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "outsider@ecminer.com", "ecminer3")
    response = client.patch(
        f"/api/reservations/{reservation_id}",
        json={
            "title": "권한 없는 수정",
            "start_at": "2026-03-01T10:00:00+09:00",
            "end_at": "2026-03-01T11:00:00+09:00",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "예약자 또는 내부 참석자만 예약을 수정할 수 있습니다."


def test_should_allow_internal_attendee_to_cancel_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "user@ecminer.com", "ecminer2")
    response = client.delete(f"/api/reservations/{reservation_id}")

    assert response.status_code == 204


def test_should_return_403_when_non_attendee_cancels_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "outsider@ecminer.com", "ecminer3")
    response = client.delete(f"/api/reservations/{reservation_id}")

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "예약자 또는 내부 참석자만 예약을 취소할 수 있습니다."


def test_should_allow_internal_attendee_to_update_reservation_minutes(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "user@ecminer.com", "ecminer2")
    response = client.patch(
        f"/api/reservations/{reservation_id}/minutes",
        json={
            "agenda": "- 공유할 내용",
            "start_at": "2026-03-01T10:00:00+09:00",
            "end_at": "2026-03-01T11:00:00+09:00",
        },
    )

    assert response.status_code == 200
    assert response.json()["agenda"] == "- 공유할 내용"


def test_should_return_403_when_non_attendee_acquires_minutes_lock(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    reservation_id = _create_reservation(client, attendees=["user@ecminer.com"])

    _login(client, "outsider@ecminer.com", "ecminer3")
    response = client.post(
        f"/api/reservations/{reservation_id}/minutes-lock",
        json={"ttl_seconds": 15},
    )

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "예약자 또는 내부 참석자만 회의록을 수정할 수 있습니다."
