"""LLM 调用日志服务 —— 独立 DB session，与业务 session 解耦"""
from database import SessionLocal
from config import (
    DEEPSEEK_MODEL,
    LLM_PRICE_INPUT_PER_1M, LLM_PRICE_OUTPUT_PER_1M, LLM_COST_CURRENCY,
)


def _estimate_tokens(text: str) -> int:
    """中文场景粗略 token 估算，保守按 1.5 字符 ≈ 1 token"""
    if not text:
        return 0
    return max(1, int(len(text) / 1.5))


def _estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    if not LLM_PRICE_INPUT_PER_1M and not LLM_PRICE_OUTPUT_PER_1M:
        return 0.0
    return (prompt_tokens / 1_000_000 * LLM_PRICE_INPUT_PER_1M
            + completion_tokens / 1_000_000 * LLM_PRICE_OUTPUT_PER_1M)


def log_llm_call(
    *,
    purpose: str,
    user_id: int | None = None,
    record_id: int | None = None,
    case_id: int | None = None,
    model: str = DEEPSEEK_MODEL,
    temperature: float | None = None,
    max_tokens: int | None = None,
    latency_ms: int = 0,
    status: str = "success",
    error_type: str | None = None,
    error_message: str | None = None,
    request_text: str = "",
    response_text: str = "",
    usage: dict | None = None,
    meta: dict | None = None,
):
    """异步安全：使用独立 DB session 快速写入日志"""
    # 估算 token
    if usage:
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
        total_tokens = usage.get("total_tokens") or ((prompt_tokens or 0) + (completion_tokens or 0))
        token_estimated = 0 if total_tokens else 1
    else:
        prompt_tokens = _estimate_tokens(request_text)
        completion_tokens = _estimate_tokens(response_text)
        total_tokens = prompt_tokens + completion_tokens
        token_estimated = 1

    estimated_cost = _estimate_cost(prompt_tokens or 0, completion_tokens or 0)

    db = SessionLocal()
    try:
        from models import LLMCallLog
        log_entry = LLMCallLog(
            user_id=user_id,
            record_id=record_id,
            case_id=case_id,
            purpose=purpose,
            provider="deepseek",
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            token_estimated=token_estimated,
            estimated_cost=round(estimated_cost, 6),
            cost_currency=LLM_COST_CURRENCY,
            latency_ms=latency_ms,
            status=status,
            error_type=error_type,
            error_message=(error_message or "")[:500] if error_message else None,
            request_chars=len(request_text) if request_text else None,
            response_chars=len(response_text) if response_text else None,
            meta=meta,
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
