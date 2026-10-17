"""Candidates: list/search/paginate, create, edit, archive, move stage."""
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import Candidate, StageHistory, User, utcnow
from app.schemas import CandidateDetail, CandidateIn, CandidatePage, StageMoveIn
from app.stages import STAGES, can_move

PAGE_SIZE = 20
DUPLICATE = "A candidate with this email already exists. Archived candidates keep their email reserved."

router = APIRouter(prefix="/candidates", tags=["candidates"], dependencies=[Depends(current_user)])


def create_candidate(db: Session, data: dict, user_id: int) -> Candidate:
    """Single create path (API and seed.py): inserts the candidate plus its first history row."""
    if db.scalar(select(Candidate.id).where(Candidate.email == data["email"])):
        raise ValueError(DUPLICATE)
    candidate = Candidate(**data, stage="Applied")
    db.add(candidate)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ValueError(DUPLICATE)
    db.add(StageHistory(candidate_id=candidate.id, from_stage=None, to_stage="Applied", changed_by_id=user_id))
    db.commit()
    return candidate


def move_stage(db: Session, candidate: Candidate, target: str, user_id: int) -> None:
    if not can_move(candidate.stage, target):
        raise ValueError(f"Cannot move {candidate.stage} to {target}.")
    db.add(StageHistory(candidate_id=candidate.id, from_stage=candidate.stage, to_stage=target,
                        changed_by_id=user_id))
    candidate.stage = target
    db.commit()


def get_candidate(db: Session, candidate_id: int) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if not candidate or candidate.archived_at:
        raise HTTPException(404, "Candidate not found.")
    return candidate


def _duplicate_error() -> HTTPException:
    return HTTPException(409, {"message": "Could not save this candidate.", "errors": {"email": DUPLICATE}})


@router.get("", response_model=CandidatePage)
def list_candidates(q: str = "", stage: str = "", page: int = Query(1, ge=1),
                    page_size: int = Query(PAGE_SIZE, ge=1, le=200), db: Session = Depends(get_db)):
    if stage and stage not in STAGES:
        raise HTTPException(422, "Unknown stage.")
    query = select(Candidate).where(Candidate.archived_at.is_(None))
    if stage:
        query = query.where(Candidate.stage == stage)
    term = q.strip()
    if term:  # escape LIKE wildcards so "50%" or "a_b" are searched literally
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        columns = (Candidate.name, Candidate.email, Candidate.role, Candidate.skills)
        query = query.where(or_(*(c.like(f"%{escaped}%", escape="\\") for c in columns)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(Candidate.created_at.desc(), Candidate.id.desc())
                       .limit(page_size).offset((page - 1) * page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, ceil(total / page_size))}


@router.post("", response_model=CandidateDetail, status_code=201)
def create(body: CandidateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        return create_candidate(db, body.model_dump(), user.id)
    except ValueError:
        raise _duplicate_error()


@router.get("/{candidate_id}", response_model=CandidateDetail)
def detail(candidate_id: int, db: Session = Depends(get_db)):
    return get_candidate(db, candidate_id)


@router.put("/{candidate_id}", response_model=CandidateDetail)
def update(candidate_id: int, body: CandidateIn, db: Session = Depends(get_db)):
    candidate = get_candidate(db, candidate_id)
    clash = select(Candidate.id).where(Candidate.email == body.email, Candidate.id != candidate_id)
    if db.scalar(clash):
        raise _duplicate_error()
    for field, value in body.model_dump().items():
        setattr(candidate, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _duplicate_error()
    return candidate


@router.delete("/{candidate_id}")
def archive(candidate_id: int, db: Session = Depends(get_db)):
    """Archive, not delete: hidden from lists, history kept, email stays reserved."""
    candidate = get_candidate(db, candidate_id)
    candidate.archived_at = utcnow()
    db.commit()
    return {"ok": True}


@router.post("/{candidate_id}/stage", response_model=CandidateDetail)
def change_stage(candidate_id: int, body: StageMoveIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    candidate = get_candidate(db, candidate_id)
    try:
        move_stage(db, candidate, body.stage, user.id)
    except ValueError as error:
        raise HTTPException(409, str(error))
    return candidate
