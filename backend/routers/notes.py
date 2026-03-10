from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_device_db
from models_device import Note

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    color: str = "#fef08a"


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    color: str | None = None
    pinned: bool | None = None


@router.get("")
def list_notes(db: Session = Depends(get_device_db)):
    notes = db.query(Note).order_by(Note.pinned.desc(), Note.updated_at.desc()).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "color": n.color,
            "pinned": n.pinned,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }
        for n in notes
    ]


@router.post("")
def create_note(note: NoteCreate, db: Session = Depends(get_device_db)):
    new_note = Note(title=note.title, content=note.content, color=note.color)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return {"id": new_note.id, "status": "created"}


@router.put("/{note_id}")
def update_note(note_id: int, note: NoteUpdate, db: Session = Depends(get_device_db)):
    existing = db.query(Note).filter(Note.id == note_id).first()
    if not existing:
        raise HTTPException(404, "Note not found")
    if note.title is not None:
        existing.title = note.title
    if note.content is not None:
        existing.content = note.content
    if note.color is not None:
        existing.color = note.color
    if note.pinned is not None:
        existing.pinned = note.pinned
    db.commit()
    return {"status": "updated"}


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_device_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()
    return {"status": "deleted"}
