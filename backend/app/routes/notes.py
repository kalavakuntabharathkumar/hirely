"""Notes: add, edit, delete."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import Note, User, utcnow
from app.routes.candidates import get_candidate
from app.schemas import NoteIn, NoteOut

router = APIRouter(tags=["notes"], dependencies=[Depends(current_user)])


def _get_note(db: Session, note_id: int) -> Note:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found.")
    return note


@router.post("/candidates/{candidate_id}/notes", response_model=NoteOut, status_code=201)
def add_note(candidate_id: int, body: NoteIn, db: Session = Depends(get_db),
             user: User = Depends(current_user)):
    get_candidate(db, candidate_id)
    note = Note(candidate_id=candidate_id, author_id=user.id, text=body.text)
    db.add(note)
    db.commit()
    return note


@router.put("/notes/{note_id}", response_model=NoteOut)
def edit_note(note_id: int, body: NoteIn, db: Session = Depends(get_db)):
    note = _get_note(db, note_id)
    note.text = body.text
    note.updated_at = utcnow()
    db.commit()
    return note


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db.delete(_get_note(db, note_id))
    db.commit()
    return {"ok": True}
