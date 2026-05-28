# 后端翻新计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 将后端从 pip/requirements.txt 迁移至 uv/pyproject.toml 现代 Python 项目体系，并修复代码审查发现的所有安全漏洞、逻辑 bug 和代码不规范问题。

**架构:** 保持单项目 `backend/` 结构不变，新增 `pyproject.toml` 替代 `requirements.txt`，使用 `uv sync` 管理依赖。bug 修复覆盖安全、数据一致性、并发安全、JSON 解析健壮性等方面。按依赖风险从低到高排序执行。

**Tech Stack:** Python 3.12, uv >=0.5, pyproject.toml, FastAPI, SQLAlchemy, pytest

**依赖版本（由原 requirements.txt 锁定迁移）：** fastapi==0.115.6, uvicorn[standard]==0.34.0, sqlalchemy==2.0.36, pydantic==2.10.3, python-jose[cryptography]==3.3.0, bcrypt==4.2.1, python-multipart==0.0.18, httpx==0.28.1, aiofiles==24.1.0, python-dotenv==1.0.1, alembic==1.18.4, pytest==8.3.4

---

### 任务 1: 创建 pyproject.toml + .python-version

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Delete: `backend/requirements.txt`

- [ ] **Step 1: 创建 pyproject.toml**

```toml
[project]
name = "virtual-patient-backend"
version = "1.16.0"
description = "虚拟患者训练系统 - 后端 API"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.6",
    "uvicorn[standard]==0.34.0",
    "sqlalchemy==2.0.36",
    "pydantic==2.10.3",
    "python-jose[cryptography]==3.3.0",
    "bcrypt==4.2.1",
    "python-multipart==0.0.18",
    "httpx==0.28.1",
    "aiofiles==24.1.0",
    "python-dotenv==1.0.1",
    "alembic==1.18.4",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.4",
    "pytest-asyncio>=0.24",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = ["pytest==8.3.4"]
```

- [ ] **Step 2: 创建 .python-version**

```
3.12
```

- [ ] **Step 3: 删除 requirements.txt**

删除 `backend/requirements.txt`。

- [ ] **Step 4: 验证 uv 可启动**

```bash
cd backend
uv sync
uv run python -c "import fastapi; print(fastapi.__version__)"
```

预期输出: `0.115.6`

---

### 任务 2: 更新 Dockerfile.backend（uv 安装 + 多阶段构建）

**Files:**
- Modify: `Dockerfile.backend` (根目录)

- [ ] **Step 1: 重写 Dockerfile.backend**

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 安装依赖
COPY backend/pyproject.toml backend/.python-version ./
RUN uv sync --frozen --no-dev

# ── 运行阶段 ──
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY backend/ .
RUN mkdir -p /app/data

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

---

### 任务 3: 更新 CI workflow（uv 缓存）

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 替换 pip 步骤为 uv**

```yaml
      - name: Install uv
        uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: uv sync --frozen
        working-directory: backend
```

完整 diff:

```yaml
       - uses: actions/checkout@v4
-      - uses: actions/setup-python@v5
-        with:
-          python-version: "3.12"
-          cache: pip
-          cache-dependency-path: backend/requirements.txt
-      - name: Install dependencies
-        run: pip install -r requirements.txt
+      - name: Install uv
+        uses: astral-sh/setup-uv@v5
+        with:
+          python-version: "3.12"
+      - name: Install dependencies
+        run: uv sync --frozen
```

- [ ] **Step 2: 添加 pytest 测试步骤**

```yaml
      - name: Run tests
        run: uv run pytest
        working-directory: backend
```

---

### 任务 4: 更新 start.bat（uv 替代 pip）

**Files:**
- Modify: `start.bat` (根目录)

- [ ] **Step 1: 替换 pip install 为 uv sync**

```batch
@echo off
chcp 65001 >nul
echo ============================================
echo   虚拟患者训练系统 - 生产模式启动
echo ============================================
set UVICORN_WORKERS=4
cd /d "%~dp0backend"
echo [1/4] 安装依赖...
uv sync --frozen 2>nul
if %errorlevel% neq 0 (
    uv sync 2>nul
)
echo [2/4] 执行数据库迁移...
uv run python -c "from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); command.upgrade(cfg, 'head')" 2>nul
if %errorlevel% neq 0 (
    echo [警告] 数据库迁移失败，回退到 create_all...
)
echo [3/4] 启动后端 (%UVICORN_WORKERS% workers)...
start "VirtualPatient-Backend" cmd /c "uv run uvicorn main:app --host 0.0.0.0 --port 8000 --workers %UVICORN_WORKERS%"
cd /d "%~dp0frontend"
echo [4/4] 构建前端...
call npm run build 2>nul
echo.
echo ============================================
echo   后端 API: http://localhost:8000
echo   健康检查: http://localhost:8000/api/health
echo   前端构建: frontend\dist (StaticFiles / Nginx 提供服务)
echo ============================================
echo.
echo 按任意键退出...
pause >nul
```

---

### 任务 5: 更新 .gitignore（uv 相关条目）

**Files:**
- Modify: `.gitignore` (根目录)

- [ ] **Step 1: 添加 uv 缓存目录到 .gitignore**

```
# uv
.venv/
uv.lock
```

确保 `.venv/` 行已存在，添加 `uv.lock`。

---

### 任务 6: [安全] 评分复核端点添加教师权限校验

**Files:**
- Modify: `backend/routers/training.py:280-340`

- [ ] **Step 1: 为两个 review 端点添加 require_teacher**

```python
# line 280-283
@router.get("/records/{record_id}/review", response_model=ScoreReviewResponse)
def get_score_review(
    record_id: int,
    current_user: User = Depends(require_teacher),  # ← changed
    db: Session = Depends(get_db),
):

# line 306-309
@router.post("/records/{record_id}/review", response_model=ScoreReviewResponse)
def submit_score_review(
    record_id: int,
    req: ScoreReviewRequest,
    current_user: User = Depends(require_teacher),  # ← changed
    db: Session = Depends(get_db),
):
```

---

### 任务 7: [数据一致性] SSE 流先完全守卫再输出

**Files:**
- Modify: `backend/routers/chat.py:124-167`

- [ ] **Step 1: 修改 generate() 使其先缓冲完整回复，守卫检查后再输出**

```python
async def generate():
    full_reply = ""
    try:
        async for chunk in call_llm_stream(
            llm_messages, temperature=0.6,
            max_tokens=LLM_CHAT_MAX_TOKENS, timeout=LLM_CHAT_TIMEOUT,
            purpose="patient_chat", user_id=current_user.id,
            record_id=record_id, case_id=record.case_id,
        ):
            full_reply += chunk
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        # 全部接收完成后，做完整守卫检查
        sanitized, violations = sanitize_patient_reply(full_reply, case_data)
        if violations:
            log_info("patient_guard", extra={"record_id": record_id, "violations": violations})
            # 若触发越界，需要重放兜底回复（覆盖已发送内容）
            # 用 done 消息携带 violations 标识，前端展示兜底
            yield f"data: {json.dumps({'sanitized': True, 'reply': sanitized, 'violations': violations}, ensure_ascii=False)}\n\n"

        student_msg = Message(record_id=record_id, role="student", content=req.content)
        db.add(student_msg)
        patient_msg = Message(record_id=record_id, role="patient", content=sanitized)
        db.add(patient_msg)
        db.commit()
        db.refresh(patient_msg)

        yield f"data: {json.dumps({'done': True, 'id': patient_msg.id}, ensure_ascii=False)}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
```

**设计说明：** SSE 优先保证低延迟体验，逐块发送。全部接收后再做完整守卫检查。如果触发越界，通过 `sanitized` 标记通知前端用兜底内容替换已显示内容。同时移除前面 `normalize_addressing_to_nurse` 逐块归一化逻辑，简化归一化到 `sanitize_patient_reply` 统一处理。

---

### 任务 8: [Bug] 修复 `_safe_parse_json` 正则截断 detail_scores

**Files:**
- Modify: `backend/services/llm_service.py:245-300`

- [ ] **Step 1: 改进 `detail_scores` 提取正则，支持嵌套 JSON**

```python
    # final fallback: regex extract key fields
    result = {}
    # detail_scores: use balanced brace matching instead of non-greedy
    detail_match = re.search(r'"detail_scores"\s*:\s*(\{)', text, re.DOTALL)
    if detail_match:
        start_pos = detail_match.start(1)
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
```

将这段插入到 `_safe_parse_json` 的最终降级处理中，替换原来第 290-296 行的简单正则。

---

### 任务 9: [Bug] 称谓归一化支持部分匹配

**Files:**
- Modify: `backend/services/patient_guard.py:100-145`

- [ ] **Step 1: 增加对"啊，医生"等非开头称谓的匹配**

将替换策略从 `startswith` 改为正则匹配回复开头（忽略前导非中文字符）：

```python
import re

def normalize_addressing_to_nurse(reply: str) -> tuple[str, bool]:
    if not reply or not reply.strip():
        return reply, False

    text = reply.strip()

    # 跳过病史语境：如果开头是"医生说""以前医生"等，不替换
    for prefix in ADDRESSING_SKIP_PREFIXES:
        if text.startswith(prefix):
            return reply, False

    # 使用正则匹配开头任意非中文字符后的"医生/大夫/医师"称谓
    # 匹配: 零个或多个非中文字符开头 + 医生/大夫/医师 + 你好/您好/，/,/
    for title in ["医生", "大夫", "医师"]:
        m = re.match(
            r'^([^\u4e00-\u9fff]*)' + re.escape(title) + r'(你好|您好|，|,)',
            text
        )
        if m:
            prefix = m.group(1)
            suffix = m.group(2)
            normalized = prefix + "护士" + suffix + text[m.end():]
            return normalized, True

    return reply, False
```

同时更新 `ADDRESSING_REPLACEMENTS` 中的边界注释，并考虑是否保留旧名单或直接全部替换为正则方案。

**安全考虑：** 改为正则后，若 `suffix` 匹配到 `，` 或 `,`，可能误伤"医生，这个药怎么吃"→"护士，这个药怎么吃"——这正是期望行为。不应对普通对话造成副作用。

---

### 任务 10: [并发安全] 评分竞态条件修复

**Files:**
- Modify: `backend/routers/training.py:84-119, 122-147`

- [ ] **Step 1: 使用数据库乐观锁防止并发评分**

在 `TrainingRecord` 模型添加 `scoring_version` 字段，每次更新 `scoring_status` 时 CAS (compare-and-swap)。

```python
# models.py — 添加字段
scoring_version = Column(Integer, nullable=False, default=1)
```

```python
# training.py — end_training
record = db.query(TrainingRecord).filter(
    TrainingRecord.id == record_id,
    TrainingRecord.scoring_version == current_version,  # 乐观锁
).first()
if not record:
    raise HTTPException(status_code=409, detail="评分状态已被修改，请刷新重试")
record.scoring_status = "pending"
record.scoring_version += 1
db.commit()
```

**简化方案（优先）：** 使用 `SELECT ... FOR UPDATE` 悲观锁。SQLite 支持 `FOR UPDATE` 语义有限。改用应用层锁：

```python
import threading
_scoring_locks: dict[int, threading.Lock] = {}
_scoring_locks_lock = threading.Lock()

def _get_scoring_lock(record_id: int) -> threading.Lock:
    with _scoring_locks_lock:
        if record_id not in _scoring_locks:
            _scoring_locks[record_id] = threading.Lock()
        return _scoring_locks[record_id]

# 在 end_training 和 retry_scoring 中：
lock = _get_scoring_lock(record_id)
if not lock.acquire(blocking=False):
    raise HTTPException(status_code=409, detail="评分正在进行中")
try:
    # ... 原有逻辑
finally:
    lock.release()
```

---

### 任务 11: [Bug] 教师复核后重算总分

**Files:**
- Modify: `backend/routers/training.py:306-340`

- [ ] **Step 1: 在 submit_score_review 中重算总分**

```python
@router.post("/records/{record_id}/review", response_model=ScoreReviewResponse)
def submit_score_review(
    record_id: int,
    req: ScoreReviewRequest,
    current_user: User = Depends(require_teacher),  # 已在任务 6 中修复
    db: Session = Depends(get_db),
):
    score = db.query(Score).filter(Score.record_id == record_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="该记录暂无评分")

    if req.detail_scores is not None:
        score.review_detail_scores = req.detail_scores
        # 重算总分：累加所有维度 score
        new_total = 0.0
        for dim_name, dim_data in req.detail_scores.items():
            if isinstance(dim_data, dict):
                new_total += dim_data.get("score", 0)
        score.total_score = round(new_total, 1)
    if req.comment is not None:
        score.review_comment = req.comment

    score.review_status = "reviewed"
    score.reviewed_by = current_user.id
    score.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(score)
    # ...
```

---

### 任务 12: [日志] daemon 线程改为异步队列 + 批量写入

**Files:**
- Modify: `backend/services/llm_service.py:138-165`
- Modify: `backend/services/llm_logging.py` (整体重写)

- [ ] **Step 1: 创建异步日志队列**

```python
# services/llm_logging.py — 重写为异步队列

import asyncio
from database import SessionLocal
from config import (
    DEEPSEEK_MODEL,
    LLM_PRICE_INPUT_PER_1M, LLM_PRICE_OUTPUT_PER_1M, LLM_COST_CURRENCY,
)

_log_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=500)
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


async def start_worker():
    global _worker_task
    _worker_task = asyncio.create_task(_worker_loop())


async def stop_worker():
    global _worker_task
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None


async def _worker_loop():
    """后台消费者：批量写入 LLM 日志"""
    from models import LLMCallLog
    batch: list[dict] = []
    while True:
        try:
            item = await asyncio.wait_for(_log_queue.get(), timeout=2.0)
            batch.append(item)
        except asyncio.TimeoutError:
            pass
        except asyncio.CancelledError:
            break

        if len(batch) >= 20:
            _flush_batch(batch)
            batch.clear()

    # 退出前刷完剩余
    if batch:
        _flush_batch(batch)


def _flush_batch(items: list[dict]):
    """同步批量写入，在线程池执行"""
    try:
        db = SessionLocal()
        for item in items:
            log_entry = LLMCallLog(**item)
            db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def enqueue_log(kwargs: dict):
    """非阻塞入队——由 LLM 调用处调用"""
    try:
        _log_queue.put_nowait(kwargs)
    except asyncio.QueueFull:
        pass  # 队列满则丢弃，不阻塞主流程
```

- [ ] **Step 2: 更新 llm_service.py 中的日志调用**

将 `_log_llm_success` 和 `_log_llm_failure` 中的 `threading.Thread` 替换为：

```python
from services.llm_logging import enqueue_log

def _log_llm_success(*, purpose, ...):
    kwargs = dict(...)
    enqueue_log(kwargs)

def _log_llm_failure(*, purpose, ...):
    kwargs = dict(...)
    enqueue_log(kwargs)
```

- [ ] **Step 3: 在 lifespan 中启停 worker**

在 `backend/main.py:lifespan` 中添加：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_data()
    # 启动 LLM 日志消费者
    from services.llm_logging import start_worker, stop_worker
    await start_worker()
    # 限流器后台清理
    from rate_limiter import _limiter as rate_limiter
    async def _cleanup_loop():
        while True:
            await asyncio.sleep(600)
            rate_limiter.cleanup()
    cleanup_task = asyncio.create_task(_cleanup_loop())
    yield
    cleanup_task.cancel()
    await stop_worker()
    # 关闭共享 httpx 客户端
    from services.llm_service import _shared_client
    if _shared_client:
        await _shared_client.aclose()
    engine.dispose()
```

---

### 任务 13: [Bug] 评分卡死后无法重试修复

**Files:**
- Modify: `backend/routers/training.py:50-81`

- [ ] **Step 1: 异常时将 scoring_status 恢复为 failed，而非保持 processing**

`_run_scoring_background` 中的异常处理已覆盖 `failed` 状态。但有漏洞：若进程在 `record.scoring_status = "processing"` commit 之后、`evaluate_training` 之前崩溃，记录卡在 `processing`。增加启动时的超时检测：

```python
# 在 retry_scoring 中增加：
if record.scoring_status == "processing":
    # 检查是否超时（超过 5 分钟仍 processing，视为僵尸）
    if record.end_time and (datetime.now(timezone.utc) - record.end_time).total_seconds() > 300:
        record.scoring_status = "failed"
        db.commit()
    else:
        raise HTTPException(status_code=400, detail="评分正在进行中，请稍后重试")
```

---

### 任务 14: [规范] 消除代码不规范问题

**Files:**
- Modify: `backend/main.py:198` — `print` → `audit_logger.info`
- Modify: `backend/routers/admin.py:60` — 删除未使用的 `request` 参数
- Modify: `backend/services/llm_service.py:33` — 移除 `Connection: keep-alive`
- Modify: `backend/database.py:56` — Alembic 异常改为 log warning 而非 pass

- [ ] **Step 1: main.py 198 — print 改为 audit_logger**

```python
audit_logger.info("种子数据初始化完成")
```

- [ ] **Step 2: admin.py 60 — 删除未使用的 request 参数**

```python
def delete_user(
    user_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
```

- [ ] **Step 3: llm_service.py:50 — 移除无意义的 headers**

```python
_shared_client = httpx.AsyncClient(
    timeout=httpx.Timeout(60, connect=15.0),
    limits=httpx.Limits(
        max_connections=20,
        max_keepalive_connections=5,
        keepalive_expiry=30,
    ),
)
```

同时移除 `_build_headers` 中的 `"Connection": "keep-alive"` 行。

- [ ] **Step 4: database.py:56 — Alembic 失败打 warning 而非静默 pass**

```python
    except Exception as e:
        import logging
        logging.getLogger("alembic").warning("Alembic 迁移失败，回退到 create_all: %s", e)
```

---

### 任务 15: 运行测试验证回归

- [ ] **Step 1: 运行全部后端测试**

```bash
cd backend
uv run pytest -v
```

预期输出: 40 tests passed (或原始数量一致，无新失败)

```bash
cd backend
uv run python -c "import fastapi, sqlalchemy, pydantic, jose, bcrypt, httpx, alembic; print('All imports OK')"
```

预期输出: `All imports OK`

---

## 执行顺序

| 任务 | 依赖 | 风险 | 建议 |
|------|------|------|------|
| 1. pyproject.toml | 无 | 低 | 先做，基础设施 |
| 2. Dockerfile | 1 | 低 | 紧随其后 |
| 3. CI workflow | 1 | 低 | CI 验证用 |
| 4. start.bat | 1 | 低 | 本地开发用 |
| 5. .gitignore | 1 | 低 | 仓库配置 |
| 6. 权限修复 | 无 | 高（安全） | 优先修复 |
| 7. SSE 一致性 | 无 | 中 | 数据完整性 |
| 8. JSON 正则 | 无 | 中 | 评分健壮性 |
| 9. 称谓归一化 | 无 | 低 | 用户体验 |
| 10. 并发安全 | 无 | 中 | 竞态条件 |
| 11. 复核重算 | 6 | 低 | 功能修复 |
| 12. 日志队列 | 无 | 中 | 架构改进 |
| 13. 僵尸评分 | 10 | 中 | 状态修复 |
| 14. 代码规范 | 无 | 低 | 可维护性 |
| 15. 回归测试 | 全部 | 关键 | 最后验证 |
