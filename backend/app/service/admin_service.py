from app.service.auth_service import AuthUser


def is_admin_user(user: AuthUser) -> bool:
    return user.is_admin
