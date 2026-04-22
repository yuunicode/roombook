import asyncio
from collections.abc import Iterator

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.infra.db import Base
from app.infra.user import User, count_active_admin_users, find_user_by_email_ci
from app.service.auth_service import hash_password
from scripts.seed_users import seed_users


@pytest.fixture()
def session_local() -> Iterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with factory() as session:
            session.add(
                User(
                    id="1",
                    name="admin",
                    email="test@ecminer.com",
                    department="미지정",
                    is_admin=False,
                    password_hash=hash_password("ecminer"),
                )
            )
            await session.commit()

    asyncio.run(setup_db())
    yield factory
    asyncio.run(engine.dispose())


def test_should_seed_users_and_promote_bootstrap_admin(
    session_local: async_sessionmaker[AsyncSession],
) -> None:
    async def scenario() -> None:
        async with session_local() as session:
            await seed_users(session)

        async with session_local() as session:
            seeded_admin = await find_user_by_email_ci(
                session,
                "jykoo@ecminer.com",
                include_inactive=True,
            )
            assert seeded_admin is not None
            assert seeded_admin.is_admin is True
            assert await count_active_admin_users(session) == 1

    asyncio.run(scenario())


def test_should_not_duplicate_seed_users_when_run_multiple_times(
    session_local: async_sessionmaker[AsyncSession],
) -> None:
    async def scenario() -> None:
        async with session_local() as session:
            await seed_users(session)

        async with session_local() as session:
            await seed_users(session)

        async with session_local() as session:
            row = await session.execute(select(func.count()).select_from(User).where(User.email == "jykoo@ecminer.com"))
            assert int(row.scalar_one() or 0) == 1

    asyncio.run(scenario())
