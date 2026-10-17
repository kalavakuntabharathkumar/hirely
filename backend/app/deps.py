"""Who is logged in. Every route except login depends on current_user."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserSession, utcnow
from app.security import hash_token


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
        if row and row.expires_at > utcnow():
            user = db.get(User, row.user_id)
            if user and user.active:
                return user
        elif row:
            db.delete(row)  # expired: clean it up
            db.commit()
    raise HTTPException(401, "Not signed in.")
