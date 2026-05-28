from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import User, Case, TrainingRecord, Message
from schemas import ChatMessageRequest, ChatMessageResponse
from auth import get_current_user
from services.llm_service import call_llm, call_llm_stream, build_patient_system_prompt
from services.patient_guard import (
    get_allowed_hidden_info, get_revealed_topics, sanitize_patient_reply,
    normalize_addressing_to_nurse,
)
from config import LLM_CHAT_TIMEOUT, LLM_CHAT_MAX_TOKENS
from rate_limiter import check_chat_limit
from logger import log_info
import json

router = APIRouter(prefix="/api/chat", tags=["对话"])

# 已泄露主题缓存（按 record_id 记录已触发的隐藏信息主题）
_disclosed_topics: dict[int, set] = {}


def _build_llm_context(case_data: dict, history_messages: list,
                       student_content: str, record_id: int) -> list:
    """构建 LLM 消息列表，含隐藏信息筛选"""
    # 从历史对话中恢复已泄露主题
    history_text = " ".join(m.content for m in history_messages)
    if record_id not in _disclosed_topics:
        _disclosed_topics[record_id] = get_revealed_topics(history_text, case_data)

    # 本轮允许的隐藏信息
    allowed = get_allowed_hidden_info(case_data, student_content, _disclosed_topics[record_id])

    # 更新已泄露主题
    for h in allowed:
        if h.get("triggered") and h.get("topic"):
            _disclosed_topics[record_id].add(h["topic"])

    system_prompt = build_patient_system_prompt(case_data, allowed)
    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in history_messages[-16:]:  # 最近 16 条（8 轮对话）
        role = "user" if msg.role == "student" else "assistant"
        llm_messages.append({"role": role, "content": msg.content})
    llm_messages.append({"role": "user", "content": student_content})
    return llm_messages, allowed


def _cleanup_disclosed_topics(record_id: int):
    """清理已泄露主题缓存"""
    _disclosed_topics.pop(record_id, None)


@router.post("/{record_id}/message", response_model=ChatMessageResponse)
async def send_message(
    record_id: int,
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="训练记录不存在")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能在自己训练中发送消息")
    if record.status != "in_progress":
        raise HTTPException(status_code=400, detail="训练已结束")

    check_chat_limit(current_user.id)

    case = db.query(Case).filter(Case.id == record.case_id).first()
    case_data = case.case_data or {}

    messages = db.query(Message).filter(Message.record_id == record_id).order_by(Message.created_at).all()
    llm_messages, _allowed = _build_llm_context(case_data, messages, req.content, record_id)

    try:
        reply = await call_llm(llm_messages, temperature=0.6,
                                max_tokens=LLM_CHAT_MAX_TOKENS, timeout=LLM_CHAT_TIMEOUT, max_retries=2,
                                purpose="patient_chat", user_id=current_user.id,
                                record_id=record_id, case_id=record.case_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM调用失败: {str(e)}")

    # 角色守卫：检测越界并替换
    sanitized, violations = sanitize_patient_reply(reply, case_data)
    if violations:
        log_info("patient_guard", extra={"record_id": record_id, "violations": violations})

    student_msg = Message(record_id=record_id, role="student", content=req.content)
    db.add(student_msg)
    patient_msg = Message(record_id=record_id, role="patient", content=sanitized)
    db.add(patient_msg)
    db.commit()
    db.refresh(patient_msg)

    return ChatMessageResponse(role="patient", content=sanitized)


@router.post("/{record_id}/message/stream")
async def send_message_stream(
    record_id: int,
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """流式发送消息：逐字返回 LLM 回复，大幅提升感知速度"""
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="训练记录不存在")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能在自己训练中发送消息")
    if record.status != "in_progress":
        raise HTTPException(status_code=400, detail="训练已结束")

    check_chat_limit(current_user.id)

    case = db.query(Case).filter(Case.id == record.case_id).first()
    case_data = case.case_data or {}

    messages = db.query(Message).filter(Message.record_id == record_id).order_by(Message.created_at).all()
    llm_messages, _allowed = _build_llm_context(case_data, messages, req.content, record_id)

    async def generate():
        full_reply = ""
        first_buffer = ""       # 首段缓冲，防止流式中出现错误称呼
        buffer_released = False
        SENTENCE_BREAK = {",", "，", "。", ".", "!", "！", "?", "？", "\n", " "}
        try:
            async for chunk in call_llm_stream(
                llm_messages, temperature=0.6,
                max_tokens=LLM_CHAT_MAX_TOKENS, timeout=LLM_CHAT_TIMEOUT,
                purpose="patient_chat", user_id=current_user.id,
                record_id=record_id, case_id=record.case_id,
            ):
                full_reply += chunk

                if not buffer_released:
                    first_buffer += chunk
                    # 缓冲到 12 字或遇到句读后释放
                    if len(first_buffer) >= 12 or any(c in first_buffer for c in SENTENCE_BREAK):
                        buffer_released = True
                        # 对全量回复做称谓归一化后一次性输出
                        fixed, _was = normalize_addressing_to_nurse(full_reply)
                        yield f"data: {json.dumps({'content': fixed}, ensure_ascii=False)}\n\n"
                else:
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            # 如果回复极短（<12字且无句读），缓冲区可能未释放
            if not buffer_released and full_reply:
                fixed, _was = normalize_addressing_to_nurse(full_reply)
                yield f"data: {json.dumps({'content': fixed}, ensure_ascii=False)}\n\n"

            # 角色守卫：检测越界并替换
            sanitized, violations = sanitize_patient_reply(full_reply, case_data)
            if violations:
                log_info("patient_guard", extra={"record_id": record_id, "violations": violations})

            student_msg = Message(record_id=record_id, role="student", content=req.content)
            db.add(student_msg)
            patient_msg = Message(record_id=record_id, role="patient", content=sanitized)
            db.add(patient_msg)
            db.commit()
            db.refresh(patient_msg)

            yield f"data: {json.dumps({'done': True, 'id': patient_msg.id}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
