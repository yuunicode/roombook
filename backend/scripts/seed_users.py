import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db import SessionLocal
from app.infra.user import User, count_active_admin_users, find_user_by_email_ci
from app.service.auth_service import hash_password

DEFAULT_USER_PASSWORD = "ecminer"
LEGACY_ADMIN_EMAIL = "test@ecminer.com"

USERS_DATA = [
    # R&D센터
    {"name": "최숙", "email": "choisook@ecminer.com", "department": "R&D센터"},
    {"name": "김형준", "email": "hjkim@ecminer.com", "department": "R&D센터"},
    {"name": "김범곤", "email": "bgkim@ecminer.com", "department": "R&D센터"},
    {"name": "박재열", "email": "jypark@ecminer.com", "department": "R&D센터"},
    {"name": "최환민", "email": "hmchoi@ecminer.com", "department": "R&D센터"},
    {"name": "이한빛", "email": "hblee@ecminer.com", "department": "R&D센터"},
    {"name": "이송화", "email": "shlee1@ecminer.com", "department": "R&D센터"},
    {"name": "구지윤", "email": "jykoo@ecminer.com", "department": "R&D센터", "is_admin": True},
    {"name": "구하은", "email": "hekoo@ecminer.com", "department": "R&D센터"},
    {"name": "공보름", "email": "brgong@ecminer.com", "department": "R&D센터"},
    {"name": "구완모", "email": "wmku@ecminer.com", "department": "R&D센터"},
    {"name": "김윤호", "email": "yhkim@ecminer.com", "department": "R&D센터"},
    # 컨설팅
    {"name": "최훈영", "email": "hychoi@ecminer.com", "department": "컨설팅"},
    {"name": "권경원", "email": "kwkwon@ecminer.com", "department": "컨설팅"},
    {"name": "신민수", "email": "msshin@ecminer.com", "department": "컨설팅"},
    {"name": "손준성", "email": "jsson@ecminer.com", "department": "컨설팅"},
    {"name": "박진윤", "email": "jinypark@ecminer.com", "department": "컨설팅"},
    {"name": "이동욱", "email": "dwlee@ecminer.com", "department": "컨설팅"},
    {"name": "박준정", "email": "jjpark@ecminer.com", "department": "컨설팅"},
    {"name": "김선중", "email": "sjkim@ecminer.com", "department": "컨설팅"},
    {"name": "김기훈", "email": "ghkim@ecminer.com", "department": "컨설팅"},
    {"name": "이지윤", "email": "jylee@ecminer.com", "department": "컨설팅"},
]


async def seed_users(session: AsyncSession | None = None) -> None:
    """현재 async SQLAlchemy 세션을 사용해 사용자 데이터를 삽입한다."""
    if session is None:
        async with SessionLocal() as managed_session:
            await _seed_users_with_session(managed_session)
        return

    await _seed_users_with_session(session)


async def _seed_users_with_session(session: AsyncSession) -> None:
    try:
        default_password_hash = hash_password(DEFAULT_USER_PASSWORD)

        for user_data in USERS_DATA:
            normalized_email = user_data["email"].strip().lower()
            existing_user = await find_user_by_email_ci(
                session,
                normalized_email,
                include_inactive=True,
            )

            if existing_user is not None:
                print(f"SKIP {user_data['name']} <{normalized_email}> already exists")
                continue

            user_id = normalized_email.split("@", 1)[0]
            is_admin = bool(user_data.get("is_admin", False))

            session.add(
                User(
                    id=user_id,
                    name=user_data["name"],
                    email=normalized_email,
                    department=user_data["department"],
                    is_admin=is_admin,
                    password_hash=default_password_hash,
                )
            )
            admin_suffix = " [admin]" if is_admin else ""
            print(f"ADD  {user_data['name']} ({user_data['department']}){admin_suffix}")

        await _ensure_bootstrap_admin(session)
        await session.commit()
        print("\nSeed completed.")
    except Exception:
        await session.rollback()
        raise


async def _ensure_bootstrap_admin(session: AsyncSession) -> None:
    if await count_active_admin_users(session) > 0:
        return

    bootstrap_admin_emails = [
        user_data["email"].strip().lower() for user_data in USERS_DATA if bool(user_data.get("is_admin", False))
    ]

    for email in bootstrap_admin_emails:
        candidate = await find_user_by_email_ci(session, email, include_inactive=True)
        if candidate is None or not candidate.is_active:
            continue
        candidate.is_admin = True
        print(f"PROMOTE {candidate.name} <{candidate.email}> as bootstrap admin")

    if await count_active_admin_users(session) > 0:
        return

    legacy_admin = await find_user_by_email_ci(session, LEGACY_ADMIN_EMAIL, include_inactive=True)
    if legacy_admin is None or not legacy_admin.is_active:
        return

    legacy_admin.is_admin = True
    print(f"PROMOTE {legacy_admin.name} <{legacy_admin.email}> as fallback admin")


if __name__ == "__main__":
    print("Seeding users...\n")
    asyncio.run(seed_users())
