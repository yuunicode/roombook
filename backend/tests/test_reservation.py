from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def test_should_create_and_return_attendees_in_reservation_detail(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")

    create_response = client.post(
        "/api/reservations",
        json={
            "room_id": "A",
            "title": "킥오프",
            "purpose": "주간 목표 정렬",
            "agenda_url": "https://example.com/agenda/1",
            "start_at": "2026-03-01T10:00:00+09:00",
            "end_at": "2026-03-01T11:00:00+09:00",
            "attendees": ["user@ecminer.com"],
        },
    )
    assert create_response.status_code == 201
    reservation_id = create_response.json()["id"]

    detail_response = client.get(f"/api/reservations/{reservation_id}")
    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert payload["purpose"] == "주간 목표 정렬"
    assert payload["agenda_url"] == "https://example.com/agenda/1"
    assert payload["room_name"] == "대회의실"
    assert len(payload["attendees"]) == 1
    assert payload["attendees"][0]["email"] == "user@ecminer.com"


def test_should_return_404_when_accessing_other_users_reservation(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    create_response = client.post(
        "/api/reservations",
        json={
            "room_id": "A",
            "title": "개인 회의",
            "start_at": "2026-03-02T09:00:00+09:00",
            "end_at": "2026-03-02T10:00:00+09:00",
        },
    )
    assert create_response.status_code == 201
    reservation_id = create_response.json()["id"]

    _login(client, "user@ecminer.com", "ecminer2")
    response = client.get(f"/api/reservations/{reservation_id}")
    assert response.status_code == 404
