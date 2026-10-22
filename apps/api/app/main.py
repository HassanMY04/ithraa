from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import (
    admin,
    auth,
    candidate,
    common,
    student,
    teacher,
)

settings = get_settings()

app = FastAPI(title="Ithraa API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (
    auth.router, common.router,
    student.router, student.public_router,
    teacher.router,
    admin.router,
    candidate.router,
):
    app.include_router(r, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
