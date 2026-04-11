from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import ADMIN_DEPARTMENT, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_USER_ID
from app.infra.user import User
from app.infra.user_repo import add_user, find_user_by_email_ci, find_user_by_id
from app.service.auth_service import AuthUser, hash_password


def is_admin_user(user: AuthUser) -> bool:
    return user.is_admin


async def ensure_admin_user(db: AsyncSession) -> None:
    admin_by_id = await find_user_by_id(db, ADMIN_USER_ID, include_inactive=True)
    normalized_admin_email = ADMIN_EMAIL
    password_hash = hash_password(ADMIN_PASSWORD)

    if admin_by_id is not None:
        if admin_by_id.email.strip().lower() != normalized_admin_email:
            raise RuntimeError("ADMIN_USER_ID 계정의 이메일이 ADMIN_EMAIL과 다릅니다.")
        admin_by_id.name = ADMIN_NAME
        admin_by_id.email = normalized_admin_email
        admin_by_id.department = ADMIN_DEPARTMENT
        admin_by_id.is_admin = True
        admin_by_id.is_active = True
        admin_by_id.password_hash = password_hash
        await db.commit()
        return

    admin_by_email = await find_user_by_email_ci(db, normalized_admin_email, include_inactive=True)
    if admin_by_email is not None:
        raise RuntimeError("ADMIN_EMAIL이 이미 다른 사용자 ID에 할당되어 있습니다.")

    add_user(
        db,
        User(
            id=ADMIN_USER_ID,
            name=ADMIN_NAME,
            email=normalized_admin_email,
            department=ADMIN_DEPARTMENT,
            is_admin=True,
            password_hash=password_hash,
        ),
    )
    await db.commit()
