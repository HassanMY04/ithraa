from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_token
from app.models import User

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, sign in again")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require_role(role: str):
    def dep(user: CurrentUser) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only {role}s can do this")
        return user

    return dep


StudentUser = Annotated[User, Depends(require_role("student"))]
TeacherUser = Annotated[User, Depends(require_role("teacher"))]
AdminUser = Annotated[User, Depends(require_role("admin"))]
