"""Settings, read from environment variables (and backend/.env if present)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env(path: Path) -> None:  # tiny .env reader; real environment variables win
    if path.is_file():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.partition("=")
            if sep and not key.lstrip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env(BASE_DIR / ".env")


class Settings:
    ENV = os.getenv("HIRELY_ENV", "development")
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'hirely.db'}")
    SECRET_KEY = os.getenv("SECRET_KEY", "")
    DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@hirely.test")
    DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "")
    SESSION_DAYS = int(os.getenv("SESSION_DAYS", "7"))
    COOKIE_NAME = "hirely_session"
    CSRF_HEADER = "X-Requested-With"
    CSRF_VALUE = "hirely"

    @property
    def secure_cookies(self) -> bool:
        return self.ENV == "production"


settings = Settings()

if not settings.SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and set it.")
