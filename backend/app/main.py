from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.router.auth import router as auth_router

app = FastAPI(
    title="Roombook API",
    description="회의실 예약 시스템 API",
    version="0.1.0",
)

# 프론트와 백엔드의 오리진이 다르기때문에
# 프론트가 백엔드 API에 접근할 수 있도록 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 여기서오는 브라우저만 허용
    allow_credentials=True,  # 쿠키/인증정보 포함 허용
    allow_methods=["*"],  # HTTP 메서드 전부 허용 (GET, POST, etc)
    allow_headers=["*"],  # 요청헤더 전부 허용 (Authorization, Content-Type, etc)
)

app.include_router(auth_router)
