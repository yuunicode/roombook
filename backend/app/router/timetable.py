"""timetable router"""

from fastapi import APIRouter

router = APIRouter(
    prefix="/timetable",
    tags=["timetable"],
)
