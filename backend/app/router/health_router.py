from fastapi import APIRouter
from pydantic import BaseModel

from app.service.health_service import get_health_status

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    health = get_health_status()
    return HealthResponse(status=health.status)
