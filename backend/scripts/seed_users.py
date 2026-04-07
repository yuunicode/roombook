import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.infra.db import SessionLocal
from app.infra.user import User
from app.service.auth_service import hash_password


USERS_DATA = [
    # R&D센터
    {"id": "r&d_001", "name": "구지윤", "email": "jykoo@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_002", "name": "최숙", "email": "choisook@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_003", "name": "김형준", "email": "hjkim@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_004", "name": "김범곤", "email": "bgkim@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_005", "name": "박재열", "email": "jypark@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_006", "name": "최환민", "email": "hmchoi@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_007", "name": "이한빛", "email": "hblee@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_008", "name": "이송화", "email": "shlee1@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_009", "name": "구하은", "email": "hekoo@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_010", "name": "공보름", "email": "brgong@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_011", "name": "구완모", "email": "wmku@ecminer.com", "department": "R&D센터"},
    {"id": "r&d_012", "name": "김윤호", "email": "yhkim@ecminer.com", "department": "R&D센터"},
    # 컨설팅
    {"id": "consulting_001", "name": "권경원", "email": "kwkwon@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_002", "name": "최훈영", "email": "hychoi@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_003", "name": "신민수", "email": "msshin@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_004", "name": "손준성", "email": "jsson@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_005", "name": "박진윤", "email": "jinypark@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_006", "name": "이동욱", "email": "dwlee@ecminer.com", "department": "컨설팅"},
    {"id": "consulting_007", "name": "김선중", "email": "sjkim@ecminer.com", "department": "컨설팅"},
]


async def seed_users() -> None:
    """현재 async SQLAlchemy 세션을 사용해 사용자 데이터를 삽입한다."""
    async with SessionLocal() as session:
        try:
            default_password_hash = hash_password("ecminer")

            for user_data in USERS_DATA:
                normalized_email = user_data["email"].strip().lower()
                existing_user = (
                    await session.execute(select(User).where(User.email == normalized_email))
                ).scalar_one_or_none()

                if existing_user is not None:
                    print(f"SKIP {user_data['name']} <{normalized_email}> already exists")
                    continue

                session.add(
                    User(
                        id=user_data["id"],
                        name=user_data["name"],
                        email=normalized_email,
                        department=user_data["department"],
                        password_hash=default_password_hash,
                    )
                )
                print(f"ADD  {user_data['name']} ({user_data['department']})")

            await session.commit()
            print("\nSeed completed.")
        except Exception:
            await session.rollback()
            raise


if __name__ == "__main__":
    print("Seeding users...\n")
    asyncio.run(seed_users())
