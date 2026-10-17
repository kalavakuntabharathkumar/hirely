"""Dashboard numbers: cards, funnel (with average days per stage) and recent candidates."""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import Candidate, StageHistory, utcnow
from app.schemas import DashboardOut
from app.stages import PIPELINE

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    live = Candidate.archived_at.is_(None)
    counts = dict(db.execute(select(Candidate.stage, func.count()).where(live).group_by(Candidate.stage)).all())
    total = sum(counts.values())
    hired = counts.get("Hired", 0)
    active = total - counts.get("Rejected", 0)  # active = not archived and not Rejected
    cards = {"total": total, "in_interview": counts.get("Interview", 0), "offers": counts.get("Offer", 0),
             "hired": hired, "active": active, "hire_rate": round(hired * 100 / active, 1) if active else 0}

    rows = db.execute(
        select(StageHistory.candidate_id, StageHistory.to_stage, StageHistory.changed_at)
        .join(Candidate, Candidate.id == StageHistory.candidate_id).where(live)
        .order_by(StageHistory.candidate_id, StageHistory.changed_at, StageHistory.id)
    ).all()
    reached = defaultdict(set)  # stage -> candidates that were ever in it
    spent = defaultdict(list)  # stage -> days of each stay
    now = utcnow()
    for i, (cid, stage, entered) in enumerate(rows):
        reached[stage].add(cid)
        has_next = i + 1 < len(rows) and rows[i + 1][0] == cid
        left = rows[i + 1][2] if has_next else now
        if stage in PIPELINE[:-1]:  # Hired is final, so it has no "time in stage"
            spent[stage].append((left - entered).total_seconds() / 86400)
    funnel = [{"stage": s, "count": len(reached[s]),
               "avg_days": round(sum(spent[s]) / len(spent[s]), 1) if spent[s] else None} for s in PIPELINE]

    recent = db.scalars(select(Candidate).where(live).order_by(Candidate.created_at.desc(), Candidate.id.desc())
                        .limit(5)).all()
    return {"cards": cards, "funnel": funnel, "recent": recent}
