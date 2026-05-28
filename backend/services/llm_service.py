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
        "Connection": "keep-alive",
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
                    headers={"Connection": "keep-alive"},
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
    """非阻塞：提交到后台线程执行日志写入"""
    from services.llm_logging import log_llm_call
    import threading
    t = threading.Thread(target=log_llm_call, kwargs=dict(
        purpose=purpose, user_id=user_id, record_id=record_id, case_id=case_id,
        model=DEEPSEEK_MODEL, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, status="success",
        request_text=request_text, response_text=response_text, usage=usage,
        meta=log_meta,
    ), daemon=True)
    t.start()


def _log_llm_failure(*, purpose, user_id, record_id, case_id, temperature,
                     max_tokens, latency_ms, request_text, error_type, error_message, log_meta):
    """非阻塞：提交到后台线程执行日志写入"""
    from services.llm_logging import log_llm_call
    import threading
    t = threading.Thread(target=log_llm_call, kwargs=dict(
        purpose=purpose, user_id=user_id, record_id=record_id, case_id=case_id,
        model=DEEPSEEK_MODEL, temperature=temperature, max_tokens=max_tokens,
        latency_ms=latency_ms, status="failed",
        error_type=error_type, error_message=error_message,
        request_text=request_text, meta=log_meta,
    ), daemon=True)
    t.start()


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
            m = re.search(r'"detail_scores"\s*:\s*(\{.*?\})\s*[,}]', text, re.DOTALL)
            if m:
                try:
                    result["detail_scores"] = json.loads(m.group(1))
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


def build_patient_system_prompt(case_data: dict, allowed_hidden: list[dict] | None = None) -> str:
    """根据病例数据构建虚拟患者的 System Prompt（精简强化版）

    按照留言板第 3/10/19 节优化：
    - 短规则 + 明确禁令 + 输出风格
    - 称谓修复：对话对象是护生，禁止称呼"医生""大夫""医师"
    - 只输出患者话语，不加标签和动作描写
    """
    patient_info = case_data.get("patient_info", {})
    communication_style = case_data.get("communication_style", "")

    # 已触发的隐藏信息
    if allowed_hidden is None:
        allowed_hidden = case_data.get("hidden_info_rules", [])
    triggered = [h for h in allowed_hidden if h.get("triggered")]
    hidden_lines = "\n".join(
        f"   - {h.get('content', h)}" for h in triggered
    ) if triggered else "   无"

    return f"""你是护理病史采集训练中的虚拟患者。你只能扮演患者本人，不能扮演护士、医生、老师、AI或评分者。
对话对象是护理学生/护生/护士实习生，不是医生；称呼对方时只能说"护士""同学"或直接说"你"，禁止称呼"医生""大夫""医师"。

## 核心规则
1. 只回答学生刚刚问到的问题，不主动补充完整病史
2. 资料中没有的信息说"不太清楚"或"记不清"，绝不编造
3. 隐藏信息只有学生明确问到相关主题时才透露
4. 每次中文自然口语回答，50-120字，可适当表达不适或担心
5. 不评价学生表现，不指导学生该问什么

## 患者资料
{patient_info.get('name', '')}，{patient_info.get('age', '')}岁，{patient_info.get('gender', '')}

主诉：{case_data.get('chief_complaint', '')}

已知病史：
- 现病史：{case_data.get('present_illness', '')}
- 既往史：{case_data.get('past_history', '')}
- 用药史：{case_data.get('medication_history', '')}
- 过敏史：{case_data.get('allergy_history', '')}
- 家族史：{case_data.get('family_history', '')}
- 生活习惯：{case_data.get('social_history', '')}

## 沟通风格
{communication_style}

## 可透露的隐藏信息（学生已明确问到相关主题）
{hidden_lines}

## 输出格式
只输出患者会说的话，不要加"患者："、括号说明、动作描写或分析。不要以"根据我的病例资料""作为患者""你问得很好"等开头。

现在以患者身份，用1-2句话描述来就诊的原因。"""


def build_scoring_prompt(case_data: dict, conversation_text: str) -> list:
    """构建评分用的消息列表（使用默认 rubric）"""
    from rubrics import load_rubric
    rubric = load_rubric("nursing_history_v1")
    return build_scoring_prompt_from_rubric(case_data, conversation_text, rubric)


def build_scoring_prompt_from_rubric(case_data: dict, conversation_text: str, rubric: dict) -> list:
    """根据 rubric 动态生成评分 Prompt，每项要求 evidence + reason"""
    all_required = case_data.get("required_inquiries", [])
    dimensions = rubric.get("dimensions", [])

    # 构建评分维度描述
    dim_lines = []
    json_template_dims = []
    for dim in dimensions:
        dim_name = dim["name"]
        dim_max = dim["max"]
        dim_lines.append(f"### {dim_name}（{len(dim['items'])}项，满分{dim_max}分）")
        if dim.get("description"):
            dim_lines.append(f"{dim['description']}")
        dim_lines.append("")

        item_templates = []
        for item in dim["items"]:
            anchors = item.get("anchors", {})
            anchor_text = " / ".join(f"{k}分: {v}" for k, v in sorted(anchors.items()))
            dim_lines.append(f"{dim['items'].index(item) + 1}. {item['name']} — {anchor_text}")
            item_templates.append(
                '{{"id": "' + item['id'] + '", "name": "' + item['name']
                + '", "score": 1-3, "evidence": "对话中的具体证据（30-80字）", "reason": "评分理由（20-50字）"}}'
            )
        json_template_dims.append(
            '"' + dim_name + '": {{\n'
            '      "score": 数字(满分' + str(dim_max) + '),\n'
            '      "max": ' + str(dim_max) + ',\n'
            '      "items": [\n        ' + ',\n        '.join(item_templates) + '\n      ]\n    }}'
        )

    dim_text = "\n".join(dim_lines)
    dim_json = ",\n    ".join(json_template_dims)

    raw_max = rubric.get("raw_max", rubric.get("total_max", 57))
    display_max = rubric.get("total_max", 57)

    system_prompt = f"""你是一位经验丰富的护理教育评估专家，专门评估护理学生的病史采集能力。

## 评分标准版本
{rubric.get('name', '')} v{rubric.get('version', '')}（原始{raw_max}分制，每项1-{rubric.get('raw_scale', 3)}分，系统将自动换算为{display_max}分制）

## 评估维度与条目

{dim_text}

## 必须采集到的内容清单（参考）
{json.dumps(all_required, ensure_ascii=False, indent=2)}

## 评分背景
- 学生角色：护理学生
- 训练目标：练习系统的护理病史采集技能
- 评估重点：沟通技能 + 病史采集能力

## 输出格式

必须是严格的 JSON（不含 markdown 代码块标记）：

{{
  "rubric_version": "{rubric.get('id', '')}@{rubric.get('version', '')}",
  "total_score": 数字(满分{raw_max}),
  "detail_scores": {{
    {dim_json}
  }},
  "strengths": ["表现较好的具体行为描述1", ...],
  "weaknesses": ["存在不足的具体行为描述1", ...],
  "missed_content": ["学生漏问的关键内容1", ...],
  "suggestions": "个性化改进建议。需结合对话中学生的实际表现：具体指出哪些条目做得好，哪些条目需要改进，给出可操作的改进方向。200-350字"
}}

## 评分要求

1. **逐项证据化评分**：每一条目必须根据对话实际内容独立评分。必须提供 `evidence`（对话中的具体证据，30-80字）和 `reason`（评分理由，20-50字）。学生未提及该条目相关内容则打1分，evidence 写"未涉及"。

2. **优点与不足必须具体**：strengths 和 weaknesses 要引用对话中的具体行为。

3. **漏问内容精准**：missed_content 列出学生确实没有问到的重要信息。

4. **suggestions 个性化**：结合对话实际内容反馈，格式为"你在XX方面表现得很好，但在XX方面还有提升空间，建议下次训练时注意..."。

评分要客观公正，结果要能帮助护理学生明确知道自己的优势和待改进之处。"""

    user_prompt = f"""请评估以下护理学生与患者的病史采集对话：

{conversation_text}

请逐项评分，每项给出证据和理由。"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
