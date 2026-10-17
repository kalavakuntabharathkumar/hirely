"""Login, logout, who-am-I."""
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import current_user
from app.models import User, UserSession
from app.schemas import LoginIn, UserOut
from app.security import (DUMMY_HASH, clear_session_cookie, create_session, hash_token, limiter,
                          login_key, set_session_cookie, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    key = login_key(body.email, request)
    wait = limiter.retry_after(key)
    if wait:
        raise HTTPException(429, f"Too many failed attempts. Try again in {ceil(wait / 60)} min.",
                            headers={"Retry-After": str(wait)})
    user = db.scalar(select(User).where(User.email == key[0]))
    password_ok = verify_password(user.password_hash if user else DUMMY_HASH, body.password)
    if not (user and user.active and password_ok):
        limiter.fail(key)
        raise HTTPException(401, "Incorrect email or password.")
    limiter.reset(key)
    set_session_cookie(response, create_session(db, user.id))
    return user


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db),
           _user: User = Depends(current_user)):
    token = request.cookies.get(settings.COOKIE_NAME, "")
    db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
    db.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
