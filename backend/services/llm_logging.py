"""LLM 调用日志服务 —— 异步队列批量写入，独立 DB session"""
import asyncio
import logging
from database import SessionLocal
from config import (
    DEEPSEEK_MODEL,
    LLM_PRICE_INPUT_PER_1M, LLM_PRICE_OUTPUT_PER_1M, LLM_COST_CURRENCY,
)

_logger = logging.getLogger(__name__)

_log_queue: asyncio.Queue[dict] | None = None
_worker_task: asyncio.Task | None = None


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text) / 1.5))


def _estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    if not LLM_PRICE_INPUT_PER_1M and not LLM_PRICE_OUTPUT_PER_1M:
        return 0.0
    return (prompt_tokens / 1_000_000 * LLM_PRICE_INPUT_PER_1M
            + completion_tokens / 1_000_000 * LLM_PRICE_OUTPUT_PER_1M)


def _build_entry(*, purpose, user_id, record_id, case_id, model, temperature,
                 max_tokens, latency_ms, status, error_type, error_message,
                 request_text, response_text, usage, meta):
    """构建 LLMCallLog 条目字典"""
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

    return {
        "user_id": user_id,
        "record_id": record_id,
        "case_id": case_id,
        "purpose": purpose,
        "provider": "deepseek",
        "model": model or DEEPSEEK_MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "token_estimated": token_estimated,
        "estimated_cost": round(estimated_cost, 6),
        "cost_currency": LLM_COST_CURRENCY,
        "latency_ms": latency_ms,
        "status": status,
        "error_type": error_type,
        "error_message": (error_message or "")[:500] if error_message else None,
        "request_chars": len(request_text) if request_text else None,
        "response_chars": len(response_text) if response_text else None,
        "meta": meta,
    }


async def start_worker():
    global _log_queue, _worker_task
    _log_queue = asyncio.Queue(maxsize=500)
    _worker_task = asyncio.create_task(_worker_loop())


async def stop_worker():
    global _log_queue, _worker_task
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None
    _log_queue = None


async def _worker_loop():
    batch: list[dict] = []
    while True:
        try:
            item = await asyncio.wait_for(_log_queue.get(), timeout=2.0)
            batch.append(item)
        except asyncio.TimeoutError:
            if batch:
                _flush_batch(batch)
                batch.clear()
            continue
        except asyncio.CancelledError:
            break

        if len(batch) >= 20:
            _flush_batch(batch)
            batch.clear()

    while not _log_queue.empty():
        try:
            batch.append(_log_queue.get_nowait())
        except asyncio.QueueEmpty:
            break
    if batch:
        _flush_batch(batch)


def _flush_batch(items: list[dict]):
    from models import LLMCallLog
    db = SessionLocal()
    try:
        for item in items:
            db.add(LLMCallLog(**item))
        db.commit()
    except Exception:
        _logger.exception("flush %d llm log entries failed", len(items))
        db.rollback()
    finally:
        db.close()


def enqueue_log(*, purpose, user_id=None, record_id=None, case_id=None,
                model=DEEPSEEK_MODEL, temperature=None, max_tokens=None,
                latency_ms=0, status="success", error_type=None, error_message=None,
                request_text="", response_text="", usage=None, meta=None):
    if _log_queue is None:
        return
    entry = _build_entry(
        purpose=purpose, user_id=user_id, record_id=record_id, case_id=case_id,
        model=model, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, status=status, error_type=error_type,
        error_message=error_message, request_text=request_text,
        response_text=response_text, usage=usage, meta=meta,
    )
    try:
        _log_queue.put_nowait(entry)
    except asyncio.QueueFull:
        _logger.warning("llm log queue full, dropping entry for %s", entry.get("purpose"))
