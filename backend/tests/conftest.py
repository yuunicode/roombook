import asyncio
from collections.abc import AsyncGenerator, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.infra import reservation, reservation_attendee, timetable, user  # noqa: F401
from app.infra.db import Base, get_db_session
from app.infra.user import User
from app.main import app
from app.service.auth_service import hash_password


@pytest.fixture()
def client() -> Iterator[TestClient]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            session.add_all(
                [
                    User(
                        id="1",
                        name="관리자",
                        email="admin@ecminer.com",
                        password_hash=hash_password("ecminer"),
                    ),
                    User(
                        id="2",
                        name="일반사용자",
                        email="user@ecminer.com",
                        password_hash=hash_password("ecminer2"),
                    ),
                ]
            )
            await session.commit()

    async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_local() as session:
            yield session

    asyncio.run(setup_db())
    app.dependency_overrides[get_db_session] = override_get_db_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())
