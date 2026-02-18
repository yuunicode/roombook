import os
from typing import Literal

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
