import os
from typing import Literal

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://test:ecminer@localhost:5432/roombook")

SESSION_COOKIE_NAME = "ROOMBOOK_SESSION"
SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365  # 1 year
SESSION_COOKIE_PATH = "/"
_samesite_raw = os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower()
if _samesite_raw == "strict":
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "strict"
elif _samesite_raw == "none":
    SESSION_COOKIE_SAMESITE = "none"
else:
    SESSION_COOKIE_SAMESITE = "lax"
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
SESSION_SIGNING_SECRET = os.getenv("SESSION_SIGNING_SECRET", "change-this-in-production")

# 관리자 계정 부트스트랩(서버 시작 시 users 테이블 동기화)
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID", "1").strip()
ADMIN_NAME = os.getenv("ADMIN_NAME", "admin").strip()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ecminer.com").strip().lower()
ADMIN_DEPARTMENT = os.getenv("ADMIN_DEPARTMENT", "R&D센터").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ecminer")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
