from fastapi.testclient import TestClient


def test_should_login_and_set_1year_cookie_when_credentials_are_valid(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@ecminer.com", "password": "ecminer"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "user": {
            "id": "1",
            "name": "관리자",
            "email": "admin@ecminer.com",
        }
    }
    set_cookie = response.headers.get("set-cookie", "")
    assert "ROOMBOOK_SESSION=" in set_cookie
    assert "Max-Age=31536000" in set_cookie
    assert "HttpOnly" in set_cookie


def test_should_return_401_when_login_credentials_are_invalid(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@ecminer.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
        }
    }


def test_should_return_current_user_when_session_cookie_is_valid(client: TestClient) -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@ecminer.com", "password": "ecminer"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "user": {
            "id": "1",
            "name": "관리자",
            "email": "admin@ecminer.com",
        }
    }


def test_should_return_401_when_session_cookie_is_missing(client: TestClient) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "로그인이 필요합니다.",
        }
    }


def test_should_login_with_case_insensitive_email(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "ADMIN@ECMINER.COM", "password": "ecminer"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "admin@ecminer.com"
