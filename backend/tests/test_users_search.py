from fastapi.testclient import TestClient


def test_should_return_401_when_search_users_without_login(client: TestClient) -> None:
    response = client.get("/api/users/search", params={"q": "adm"})
    assert response.status_code == 401


def test_should_search_users_by_name_or_email_with_limit(client: TestClient) -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@ecminer.com", "password": "ecminer"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/users/search", params={"q": "ecminer", "limit": 1})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["email"].endswith("@ecminer.com")
