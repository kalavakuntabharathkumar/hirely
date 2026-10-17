"""Validation for incoming data and the shapes of outgoing data."""
import re
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer, computed_field, field_validator

from app.stages import allowed_moves

Utc = Annotated[datetime, PlainSerializer(lambda d: d.isoformat() + "Z", return_type=str)]
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
PHONE_RE = re.compile(r"^[+(]?[0-9][0-9 ()\-]{5,18}[0-9]$")


def _clean(value, label: str, limit: int, required: bool = True) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be text.")
    value = value.strip()
    if required and not value:
        raise ValueError(f"{label} is required.")
    if len(value) > limit:
        raise ValueError(f"{label} must be at most {limit} characters.")
    return value


# ---- incoming -------------------------------------------------------------
class LoginIn(BaseModel):
    email: str
    password: str


# field -> (label shown in messages, max length, required?)
TEXT_FIELDS = {"name": ("Name", 120, True), "phone": ("Phone", 30, False), "role": ("Role", 120, True),
               "skills": ("Skills", 500, False), "source": ("Source", 60, False)}


class CandidateIn(BaseModel):
    name: str
    email: str
    phone: str = ""
    role: str
    skills: str = ""
    source: str = ""

    @field_validator(*TEXT_FIELDS)
    @classmethod
    def check_text(cls, v, info):
        label, limit, required = TEXT_FIELDS[info.field_name]
        v = _clean(v, label, limit, required)
        if info.field_name == "phone" and v and not PHONE_RE.match(v):
            raise ValueError("Enter a valid phone number (digits, spaces, + ( ) -).")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        v = _clean(v, "Email", 254).lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address, like name@example.com.")
        return v


class StageMoveIn(BaseModel):
    stage: str


class NoteIn(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def check_text(cls, v):
        return _clean(v, "Note", 2000)


# ---- outgoing -------------------------------------------------------------
class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    name: str
    email: str


class NoteOut(ORM):
    id: int
    text: str
    author: UserOut
    created_at: Utc
    updated_at: Utc | None


class HistoryOut(ORM):
    id: int
    from_stage: str | None
    to_stage: str
    changed_by: UserOut
    changed_at: Utc


class CandidateOut(ORM):
    id: int
    name: str
    email: str
    phone: str
    role: str
    stage: str
    skills: str
    source: str
    created_at: Utc

    @computed_field
    @property
    def allowed_moves(self) -> list[str]:
        return allowed_moves(self.stage)


class CandidateDetail(CandidateOut):
    notes: list[NoteOut]
    history: list[HistoryOut]


class CandidatePage(BaseModel):
    items: list[CandidateOut]
    total: int
    page: int
    page_size: int
    pages: int


class Cards(BaseModel):
    total: int
    in_interview: int
    offers: int
    hired: int
    active: int
    hire_rate: float


class FunnelRow(BaseModel):
    stage: str
    count: int
    avg_days: float | None


class DashboardOut(BaseModel):
    cards: Cards
    funnel: list[FunnelRow]
    recent: list[CandidateOut]
