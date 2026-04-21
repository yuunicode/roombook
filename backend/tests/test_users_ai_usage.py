import asyncio
from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from app.infra.db import get_db_session
from app.infra.global_ai_quota import GlobalAiQuota
from app.infra.user_ai_quota import UserAiQuota
from app.main import app


def _login(client: TestClient, email: str, password: str) -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


async def _insert_quota_state(period_month: str) -> None:
    override = app.dependency_overrides[get_db_session]
    async for session in override():
        session.add(
            GlobalAiQuota(
                quota_key="global",
                monthly_limit_usd=Decimal("10.0000"),
                used_usd=Decimal("0.4567"),
                period_month=period_month,
            )
        )
        session.add(
            UserAiQuota(
                user_id="2",
                monthly_limit_usd=Decimal("0.0000"),
                used_usd=Decimal("0.1234"),
                period_month=period_month,
            )
        )
        await session.commit()
        break


def test_should_return_401_when_fetching_ai_usage_without_login(client: TestClient) -> None:
    response = client.get("/api/users/ai-usage")

    assert response.status_code == 401


def test_should_return_403_when_non_admin_fetches_ai_usage(client: TestClient) -> None:
    _login(client, "user@ecminer.com", "ecminer2")

    response = client.get("/api/users/ai-usage")

    assert response.status_code == 403


def test_should_return_global_summary_and_user_usage_for_admin(client: TestClient) -> None:
    period_month = datetime.now().strftime("%Y-%m")
    _login(client, "admin@ecminer.com", "ecminer")
    asyncio.run(_insert_quota_state(period_month))

    response = client.get("/api/users/ai-usage")

    assert response.status_code == 200
    payload = response.json()

    assert payload["summary"] == {
        "monthly_limit_usd": 10.0,
        "used_usd": 0.4567,
        "remaining_usd": 9.5433,
        "period_month": period_month,
    }

    rows = payload["items"]
    assert len(rows) == 2

    admin_row = next(row for row in rows if row["user_id"] == "1")
    assert admin_row["used_usd"] == 0.0
    assert admin_row["period_month"] == period_month
    assert admin_row["updated_at"] is None

    user_row = next(row for row in rows if row["user_id"] == "2")
    assert user_row["name"] == "일반사용자"
    assert user_row["used_usd"] == 0.1234
    assert user_row["period_month"] == period_month
    assert user_row["updated_at"] is not None


async def _insert_mismatched_quota_state(period_month: str) -> None:
    override = app.dependency_overrides[get_db_session]
    async for session in override():
        session.add(
            GlobalAiQuota(
                quota_key="global",
                monthly_limit_usd=Decimal("10.0000"),
                used_usd=Decimal("0.512900"),
                period_month=period_month,
            )
        )
        session.add(
            UserAiQuota(
                user_id="2",
                monthly_limit_usd=Decimal("0.0000"),
                used_usd=Decimal("1.059500"),
                period_month=period_month,
            )
        )
        await session.commit()
        break


def test_should_use_user_usage_sum_when_global_summary_is_stale(client: TestClient) -> None:
    period_month = datetime.now().strftime("%Y-%m")
    _login(client, "admin@ecminer.com", "ecminer")
    asyncio.run(_insert_mismatched_quota_state(period_month))

    response = client.get("/api/users/ai-usage")

    assert response.status_code == 200
    payload = response.json()

    assert payload["summary"] == {
        "monthly_limit_usd": 10.0,
        "used_usd": 1.0595,
        "remaining_usd": 8.9405,
        "period_month": period_month,
    }
