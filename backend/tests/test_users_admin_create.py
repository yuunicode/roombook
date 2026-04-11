from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def test_should_return_401_when_creating_user_without_login(client: TestClient) -> None:
    response = client.post(
        "/api/users",
        json={
            "id": "new-user",
            "name": "새 사용자",
            "department": "R&D센터",
        },
    )
    assert response.status_code == 401


def test_should_return_403_when_non_admin_creates_user(client: TestClient) -> None:
    _login(client, "user@ecminer.com", "ecminer2")
    response = client.post(
        "/api/users",
        json={
            "id": "new-user",
            "name": "새 사용자",
            "department": "R&D센터",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_should_create_user_when_admin_requests(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    response = client.post(
        "/api/users",
        json={
            "id": "new-user",
            "name": "새 사용자",
            "department": "R&D센터",
        },
    )
    assert response.status_code == 201
    assert response.json() == {
        "id": "new-user",
        "name": "새 사용자",
        "email": "new-user@ecminer.com",
        "department": "R&D센터",
        "is_admin": False,
    }

    relogin = client.post(
        "/api/auth/login",
        json={"email": "new-user@ecminer.com", "password": "ecminer"},
    )
    assert relogin.status_code == 200


def test_should_return_409_when_id_or_email_is_duplicated(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    duplicated_id = client.post(
        "/api/users",
        json={
            "id": "1",
            "name": "중복 아이디",
            "department": "컨설팅",
        },
    )
    assert duplicated_id.status_code == 409
    assert duplicated_id.json()["error"]["code"] == "USER_ALREADY_EXISTS"

    duplicated_email = client.post(
        "/api/users",
        json={
            "id": "admin",
            "name": "중복 이메일",
            "department": "사업본부",
        },
    )
    assert duplicated_email.status_code == 409
    assert duplicated_email.json()["error"]["code"] == "USER_ALREADY_EXISTS"
