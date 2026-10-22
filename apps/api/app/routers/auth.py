from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import get_settings
from app.core.deps import DB
from app.core.security import create_token, verify_password
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

# The accounts behind the sidebar's "Demo · view as" switch.
DEMO_ACCOUNTS = {
    "student": "karim.haddad@ithraa.school",
    "teacher": "rana.khoury@ithraa.school",
    "admin": "hiba@ithraa.school",
}


class LoginIn(BaseModel):
    email: str
    password: str


def session_for(user: User) -> dict:
    return {"token": create_token(user.id, user.role), "role": user.role}


@router.post("/login")
def login(body: LoginIn, db: DB) -> dict:
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    return session_for(user)


@router.get("/demo")
def demo_info() -> dict:
    s = get_settings()
    return {"enabled": s.demo_mode, "accounts": DEMO_ACCOUNTS if s.demo_mode else {}}


@router.post("/demo/{role}")
def demo_login(role: str, db: DB) -> dict:
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo mode is off")
    email = DEMO_ACCOUNTS.get(role)
    user = db.scalar(select(User).where(User.email == email)) if email else None
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No demo account for this role")
    return session_for(user)
