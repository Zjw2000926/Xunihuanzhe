from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import QARequest, QAResponse
from auth import get_current_user
from services.llm_service import call_llm
from rate_limiter import check_qa_limit
from prompts import NURSING_SYSTEM_PROMPT

router = APIRouter(prefix="/api/qa", tags=["通用问答"])


@router.post("/ask", response_model=QAResponse)
async def ask_question(req: QARequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    check_qa_limit(current_user.id)

    messages = [
        {"role": "system", "content": NURSING_SYSTEM_PROMPT},
        {"role": "user", "content": req.question},
    ]

    try:
        answer = await call_llm(messages, temperature=0.7, max_tokens=1024,
                                    purpose="qa", user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI调用失败: {str(e)}")

    return QAResponse(answer=answer)
