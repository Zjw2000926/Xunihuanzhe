from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, TrainingRecord, Note
from schemas import NoteItem, NoteCreateRequest
from auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["笔记"])


@router.get("/{record_id}", response_model=list[NoteItem])
def get_notes(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if current_user.role != "teacher" and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看")

    notes = db.query(Note).filter(Note.record_id == record_id).order_by(Note.updated_at.desc()).all()
    return notes


@router.post("/{record_id}", response_model=NoteItem)
def save_note(record_id: int, req: NoteCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能在自己的训练中记笔记")
    if record.status != "in_progress":
        raise HTTPException(status_code=400, detail="训练已结束")

    note = Note(
        record_id=record_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteItem)
def update_note(note_id: int, req: NoteCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的笔记")

    note.content = req.content
    note.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_note(note_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的笔记")

    db.delete(note)
    db.commit()
    return {"message": "笔记已删除"}
