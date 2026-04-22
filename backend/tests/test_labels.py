from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def test_should_return_401_when_listing_labels_without_login(client: TestClient) -> None:
    response = client.get("/api/labels")

    assert response.status_code == 401


def test_should_list_only_none_label_by_default(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")

    response = client.get("/api/labels")

    assert response.status_code == 200
    assert response.json() == [{"name": "없음"}]
