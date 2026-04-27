from fastapi import APIRouter
from pydantic import BaseModel

from app.core.release import get_current_version

router = APIRouter(prefix="/api/release", tags=["release"])


class ReleaseInfoResponse(BaseModel):
    current_version: str


@router.get("", response_model=ReleaseInfoResponse)
async def get_release_info_api() -> ReleaseInfoResponse:
    return ReleaseInfoResponse(current_version=get_current_version())
