from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def test_should_return_401_when_deleting_user_without_login(client: TestClient) -> None:
    response = client.delete("/api/users/2")
    assert response.status_code == 401


def test_should_return_403_when_non_admin_deletes_user(client: TestClient) -> None:
    _login(client, "user@ecminer.com", "ecminer2")
    response = client.delete("/api/users/1")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_should_return_400_when_admin_deletes_self(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    response = client.delete("/api/users/1")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_ARGUMENT"


def test_should_return_409_when_demoting_last_admin(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    response = client.patch("/api/users/1/admin", json={"is_admin": False})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_should_deactivate_user_when_admin_requests(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")

    response = client.delete("/api/users/2")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    users_response = client.get("/api/users")
    assert users_response.status_code == 200
    user_ids = {item["id"] for item in users_response.json()}
    assert "2" not in user_ids

    relogin = client.post(
        "/api/auth/login",
        json={"email": "user@ecminer.com", "password": "ecminer2"},
    )
    assert relogin.status_code == 401

    _login(client, "admin@ecminer.com", "ecminer")
    search_response = client.get("/api/users/search", params={"q": "user@ecminer.com"})
    assert search_response.status_code == 200
    assert all(item["email"] != "user@ecminer.com" for item in search_response.json())
