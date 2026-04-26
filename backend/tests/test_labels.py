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
    assert response.json() == [{"name": "없음", "is_hidden": False}]


def test_should_hide_and_show_label_without_deleting_it(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    create_response = client.post("/api/labels", json={"name": "마감"})
    assert create_response.status_code == 201

    hide_response = client.patch("/api/labels/마감/visibility", json={"is_hidden": True})

    assert hide_response.status_code == 200
    assert hide_response.json() == {"name": "마감", "is_hidden": True}

    list_response = client.get("/api/labels")
    assert list_response.status_code == 200
    assert {"name": "마감", "is_hidden": True} in list_response.json()

    show_response = client.patch("/api/labels/마감/visibility", json={"is_hidden": False})

    assert show_response.status_code == 200
    assert show_response.json() == {"name": "마감", "is_hidden": False}


def test_should_not_hide_none_label(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")

    response = client.patch("/api/labels/없음/visibility", json={"is_hidden": True})

    assert response.status_code == 400


def test_should_hide_label_instead_of_deleting_it_for_legacy_delete(client: TestClient) -> None:
    _login(client, "admin@ecminer.com", "ecminer")
    create_response = client.post("/api/labels", json={"name": "보관"})
    assert create_response.status_code == 201

    delete_response = client.delete("/api/labels/보관")

    assert delete_response.status_code == 200
    list_response = client.get("/api/labels")
    assert {"name": "보관", "is_hidden": True} in list_response.json()
