"""Password hashing, session tokens, cookie flags, CSRF check and the login limiter."""
import hashlib
import hmac
import secrets
import time
from datetime import timedelta
from math import ceil

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.models import UserSession, utcnow

_hasher = PasswordHasher()
DUMMY_HASH = _hasher.hash("not-a-real-password")  # keeps timing similar for unknown emails


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def hash_token(token: str) -> str:
    """Only this keyed hash is stored; a database leak does not reveal live cookies."""
    return hmac.new(settings.SECRET_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def create_session(db: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(days=settings.SESSION_DAYS)
    db.add(UserSession(token_hash=hash_token(token), user_id=user_id, expires_at=expires))
    db.commit()
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.COOKIE_NAME, token, max_age=settings.SESSION_DAYS * 86400, path="/",
        httponly=True, samesite="lax", secure=settings.secure_cookies,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.COOKIE_NAME, path="/", httponly=True, samesite="lax", secure=settings.secure_cookies,
    )


def csrf_check(request: Request) -> None:
    """Browsers cannot send this custom header cross-site without a CORS preflight."""
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    if request.headers.get(settings.CSRF_HEADER) != settings.CSRF_VALUE:
        raise HTTPException(403, "Missing or invalid CSRF header.")


class LoginLimiter:
    """In-memory counter per (email, ip): 5 failures block that pair for 15 minutes."""

    def __init__(self, max_fails=5, block_secs=900, clock=time.monotonic):
        self.max_fails, self.block_secs, self.clock = max_fails, block_secs, clock
        self.state: dict[tuple[str, str], dict] = {}

    def retry_after(self, key) -> int:
        """Seconds left in the block, or 0 if the pair may try. Drops stale entries."""
        entry = self.state.get(key)
        if not entry:
            return 0
        now = self.clock()
        if entry["until"] > now:
            return ceil(entry["until"] - now)
        if entry["until"] or now - entry["first"] > self.block_secs:
            del self.state[key]
        return 0

    def fail(self, key) -> None:
        now = self.clock()
        self.retry_after(key)
        entry = self.state.setdefault(key, {"count": 0, "first": now, "until": 0})
        entry["count"] += 1
        if entry["count"] >= self.max_fails:
            entry["until"] = now + self.block_secs

    def reset(self, key) -> None:
        self.state.pop(key, None)


limiter = LoginLimiter()


def login_key(email: str, request: Request) -> tuple[str, str]:
    return email.strip().lower(), request.client.host if request.client else "unknown"
