import asyncio
import json
import random
import re
import time
import httpx
from logger import log_error
from config import (
    DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL,
    LLM_MAX_RETRIES,
    LLM_CONCURRENT_LIMIT,
    LLM_CHAT_TIMEOUT, LLM_CHAT_MAX_TOKENS,
    LLM_SCORING_TIMEOUT, LLM_SCORING_MAX_TOKENS,
)

# 并发限流（防止触发 DeepSeek API 限流）
_rate_limiter = asyncio.Semaphore(LLM_CONCURRENT_LIMIT)

# 可重试的 HTTP 状态码和异常类型
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
_RETRYABLE_EXCEPTIONS = (httpx.TimeoutException, httpx.ConnectError,
                          httpx.RemoteProtocolError, httpx.ReadError)

# 模块级共享客户端 —— 使用 HTTP/2 多路复用，避免连接池问题
_shared_client: httpx.AsyncClient | None = None
_shared_client_lock = asyncio.Lock()


def _build_headers() -> dict:
    return {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }


async def _get_client() -> httpx.AsyncClient:
    """延迟创建共享客户端"""
    global _shared_client
    if _shared_client is None:
        async with _shared_client_lock:
            if _shared_client is None:
                _shared_client = httpx.AsyncClient(
                    timeout=httpx.Timeout(60, connect=15.0),
                    limits=httpx.Limits(
                        max_connections=20,
                        max_keepalive_connections=5,
                        keepalive_expiry=30,
                    ),
                )
    return _shared_client


async def _reset_client():
    """连接异常时重建客户端"""
    global _shared_client
    async with _shared_client_lock:
        if _shared_client is not None:
            await _shared_client.aclose()
            _shared_client = None


async def call_llm(messages: list, temperature: float = 0.7, max_tokens: int = 512,
                   timeout: int = 30, max_retries: int = 2,
                   # 日志上下文（可选）
                   purpose: str = "other",
                   user_id: int | None = None,
                   record_id: int | None = None,
                   case_id: int | None = None,
                   log_meta: dict | None = None,
                   ) -> str:
    """调用 DeepSeek API，返回文本回复。支持自动记录调用日志。"""
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY 未配置")

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    request_text = " ".join(m.get("content", "") for m in messages)

    client = await _get_client()
    last_error = None
    t0 = time.perf_counter()
    for attempt in range(max_retries):
        async with _rate_limiter:
            try:
                resp = await client.post(
                    f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
                    headers=_build_headers(),
                    json=payload,
                    timeout=httpx.Timeout(timeout, connect=15.0),
                )
                if resp.status_code in _RETRYABLE_STATUSES:
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                else:
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    latency_ms = int((time.perf_counter() - t0) * 1000)
                    # 记录成功日志
                    _log_llm_success(
                        purpose=purpose, user_id=user_id, record_id=record_id,
                        case_id=case_id, temperature=temperature, max_tokens=max_tokens,
                        latency_ms=latency_ms, request_text=request_text,
                        response_text=content, usage=data.get("usage"),
                        log_meta=log_meta,
                    )
                    return content
            except _RETRYABLE_EXCEPTIONS as e:
                last_error = f"{type(e).__name__}: {str(e)[:200]}"
                if isinstance(e, httpx.RemoteProtocolError):
                    await _reset_client()

        if attempt < max_retries - 1:
            delay = min(2 ** attempt, 4) + random.uniform(0, 0.5)
            await asyncio.sleep(delay)

    # 所有重试失败后记录失败日志
    latency_ms = int((time.perf_counter() - t0) * 1000)
    _log_llm_failure(
        purpose=purpose, user_id=user_id, record_id=record_id,
        case_id=case_id, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, request_text=request_text,
        error_type="retries_exhausted", error_message=last_error,
        log_meta=log_meta,
    )

    msg = f"LLM调用失败（已重试{max_retries}次）: {last_error}"
    log_error(msg)
    raise RuntimeError(msg)


def _log_llm_success(*, purpose, user_id, record_id, case_id, temperature,
                     max_tokens, latency_ms, request_text, response_text, usage, log_meta):
    from services.llm_logging import enqueue_log
    enqueue_log(
        purpose=purpose, user_id=user_id, record_id=record_id, case_id=case_id,
        model=DEEPSEEK_MODEL, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, status="success",
        request_text=request_text, response_text=response_text, usage=usage,
        meta=log_meta,
    )


def _log_llm_failure(*, purpose, user_id, record_id, case_id, temperature,
                     max_tokens, latency_ms, request_text, error_type, error_message, log_meta):
    from services.llm_logging import enqueue_log
    enqueue_log(
        purpose=purpose, user_id=user_id, record_id=record_id, case_id=case_id,
        model=DEEPSEEK_MODEL, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, status="failed",
        error_type=error_type, error_message=error_message,
        request_text=request_text, meta=log_meta,
    )


async def call_llm_stream(messages: list, temperature: float = 0.7, max_tokens: int = 512,
                          timeout: int = 30,
                          purpose: str = "other",
                          user_id: int | None = None,
                          record_id: int | None = None,
                          case_id: int | None = None,
                          log_meta: dict | None = None,
                          ):
    """调用 DeepSeek API，流式返回文本块。使用共享 HTTP/2 客户端。"""
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY 未配置")

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    request_text = " ".join(m.get("content", "") for m in messages)

    client = await _get_client()
    full_reply = ""
    t0 = time.perf_counter()
    error_type = None
    error_message = None
    try:
        async with _rate_limiter:
            async with client.stream(
                "POST",
                f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
                headers=_build_headers(),
                json=payload,
                timeout=httpx.Timeout(timeout, connect=15.0),
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise RuntimeError(f"LLM流式调用失败 HTTP {resp.status_code}: {body[:200]}")
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            obj = json.loads(data)
                            delta = obj["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                full_reply += content
                                yield content
                        except json.JSONDecodeError:
                            pass
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)[:500]
        raise
    finally:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        if error_type:
            _log_llm_failure(
                purpose=purpose, user_id=user_id, record_id=record_id,
                case_id=case_id, temperature=temperature, max_tokens=max_tokens,
                latency_ms=latency_ms, request_text=request_text,
                error_type=error_type, error_message=error_message,
                log_meta=log_meta,
            )
        else:
            _log_llm_success(
                purpose=purpose, user_id=user_id, record_id=record_id,
                case_id=case_id, temperature=temperature, max_tokens=max_tokens,
                latency_ms=latency_ms, request_text=request_text,
                response_text=full_reply, usage=None,
                log_meta=log_meta,
            )


def _safe_parse_json(text: str) -> dict:
    """安全解析 LLM 返回的 JSON，处理常见格式问题"""
    text = text.strip()
    # 清除 markdown 围栏（含语言标识）
    text = re.sub(r'^```(?:json)?\s*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n?\s*```\s*$', '', text)
    text = text.strip()

    # 提取 JSON 对象
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    # 尝试标准解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 降级处理：移除尾部逗号（常见的 LLM 输出错误）
    try:
        cleaned = re.sub(r',\s*}', '}', text)
        cleaned = re.sub(r',\s*]', ']', cleaned)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 最终降级：正则提取关键字段
    result = {}
    for field in ["total_score", "strengths", "weaknesses", "missed_content",
                   "suggestions", "detail_scores"]:
        if field == "total_score":
            m = re.search(r'"total_score"\s*:\s*(\d+)', text)
            if m:
                result["total_score"] = int(m.group(1))
        elif field == "suggestions":
            m = re.search(r'"suggestions"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
            if m:
                result["suggestions"] = m.group(1)
        elif field in ("strengths", "weaknesses", "missed_content"):
            m = re.search(rf'"{field}"\s*:\s*\[([^\]]*)\]', text)
            if m:
                items = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))
                result[field] = items
        elif field == "detail_scores":
            m = re.search(r'"detail_scores"\s*:\s*(\{)', text, re.DOTALL)
            if m:
                start_pos = m.start(1)
                depth = 0
                end_pos = start_pos
                for i, ch in enumerate(text[start_pos:], start=start_pos):
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            end_pos = i + 1
                            break
                if end_pos > start_pos:
                    try:
                        result["detail_scores"] = json.loads(text[start_pos:end_pos])
                    except json.JSONDecodeError:
                        result["detail_scores"] = {}

    if not result:
        raise ValueError(f"无法解析LLM返回的JSON: {text[:500]}")
    return result


async def call_llm_json(messages: list, temperature: float = 0.3, max_tokens: int = 2048,
                        timeout: int = 120, max_retries: int = 3,
                        purpose: str = "other",
                        user_id: int | None = None,
                        record_id: int | None = None,
                        case_id: int | None = None,
                        log_meta: dict | None = None,
                        ) -> dict:
    """调用 DeepSeek API，返回 JSON 结构化结果（容错解析），支持日志记录"""
    response_text = await call_llm(
        messages, temperature, max_tokens, timeout, max_retries,
        purpose=purpose, user_id=user_id, record_id=record_id,
        case_id=case_id, log_meta=log_meta,
    )
    return _safe_parse_json(response_text)


from prompts import build_patient_system_prompt, build_scoring_prompt, build_scoring_prompt_from_rubric
