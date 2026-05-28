# AI并发稳定性优化留言板

> 目标：让系统支持约 40 名护理学生同时稳定进行病史采集训练。  
> 面向后续接手的 AI 或开发者。请把这个目标理解为“课堂/实验室试点级并发稳定”，不是单纯让服务能启动。需要同时优化后端、数据库、LLM 调用、评分任务、前端等待体验、部署方式、日志监控和压测流程。

## 一、当前系统并发风险判断

当前项目是 FastAPI + SQLite + React/Vite + DeepSeek 的轻量单体应用，适合演示和小规模试用，但如果 40 名学生同时训练，会遇到以下风险：

1. SQLite 写入并发能力有限，多名学生同时发送消息、结束训练、保存评分时可能出现锁等待。
2. 每轮对话都会调用 DeepSeek，如果 40 人同时训练，LLM 请求会成为主要瓶颈。
3. 自动评分目前同步执行，训练结束时会占用请求时间，容易导致前端长时间等待。
4. 后端没有全局并发限制、请求限流、队列和重试策略。
5. 当前没有明确的生产部署方案，例如多 worker、Nginx、进程守护、Docker 等。
6. 缺少结构化日志和性能监控，系统慢或卡住时难以定位瓶颈。
7. 前端没有完整的网络异常、评分中、请求排队等稳定性提示。
8. 没有压测脚本，无法证明系统能支撑 40 人同时使用。

关键文件：

- `backend/main.py`
- `backend/config.py`
- `backend/database.py`
- `backend/models.py`
- `backend/routers/chat.py`
- `backend/routers/training.py`
- `backend/services/llm_service.py`
- `backend/services/scoring.py`
- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/DashboardHome.jsx`
- `frontend/src/pages/History.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/vite.config.js`

## 二、40 人同时使用的目标定义

建议先定义一个可验证目标。

### 课堂场景假设

1. 同时在线学生：40 人。
2. 每人同时打开训练页。
3. 每人每 20 到 40 秒发送 1 条消息。
4. 平均每人完成 8 到 15 轮对话。
5. 课堂结束时可能有 20 到 40 人在几分钟内集中点击“结束训练”触发评分。
6. 教师同时查看后台统计和训练记录。

### 建议性能目标

1. 登录、病例列表、训练记录等普通接口：P95 小于 500ms。
2. 发送消息接口：

   - 非流式完整回复：P95 小于 10 秒。
   - 若实现流式：首字 P95 小于 3 秒。

3. 结束训练接口：1 秒内返回“评分中”。
4. 后台评分：大多数记录 10 到 60 秒内完成。
5. 40 人同时训练时，后端不能崩溃，数据库不能频繁锁死。
6. LLM 服务限流或超时时，前端必须有可理解提示和重试入口。
7. 数据不能丢：学生消息、患者回复、训练结束状态、评分结果都必须可靠保存。

## 三、优先级最高：数据库从 SQLite 迁移到 PostgreSQL

### 为什么必须迁移

SQLite 适合本地开发和演示，但 40 人同时训练会产生大量写操作：

- 保存学生消息。
- 保存患者消息。
- 更新训练状态。
- 保存评分结果。
- 教师端读取统计。

SQLite 写入串行化，容易在并发下出现锁等待或性能抖动。若目标是稳定 40 人同时使用，应优先迁移到 PostgreSQL。

### 建议修改步骤

1. 在 `backend/requirements.txt` 增加 PostgreSQL 驱动。

   可选：

   ```text
   psycopg[binary]
   ```

   或：

   ```text
   psycopg2-binary
   ```

2. 修改 `backend/database.py`。

   当前：

   ```python
   engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
   ```

   建议根据数据库类型区分：

   ```python
   connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

   engine = create_engine(
       DATABASE_URL,
       connect_args=connect_args,
       pool_pre_ping=True,
       pool_size=10,
       max_overflow=20,
       pool_recycle=1800,
   )
   ```

3. 在 `.env.example` 中增加 PostgreSQL 示例。

   ```env
   DATABASE_URL=postgresql+psycopg://virtual_patient:password@127.0.0.1:5432/virtual_patient
   ```

4. 引入 Alembic 迁移。

   ```powershell
   pip install alembic
   alembic init migrations
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```

5. 写一个数据迁移脚本，将 SQLite 中的种子病例、用户和历史训练记录迁移到 PostgreSQL。

   推荐文件：

   - `backend/scripts/migrate_sqlite_to_postgres.py`

6. 给常用查询字段加索引。

   建议重点：

   - `users.username`
   - `training_records.user_id`
   - `training_records.case_id`
   - `training_records.status`
   - `training_records.start_time`
   - `messages.record_id`
   - `messages.created_at`
   - `scores.record_id`

   当前模型已有部分 index，但建议系统检查并补齐。

### 验证

1. 40 人压测时不应出现大量数据库 locked。
2. 教师端记录列表、统计接口在数据量增加后仍稳定。
3. 并发写入消息时无丢失。

## 四、后端服务部署强化

### 1. 使用多 worker 运行 FastAPI

当前开发启动方式：

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

生产或课堂试点建议：

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

或 Linux 下：

```bash
gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 2 \
  --bind 0.0.0.0:8000 \
  --timeout 120
```

建议 worker 数：

- 2 核 CPU：2 workers。
- 4 核 CPU：2 到 4 workers。

注意：

- 如果仍用 SQLite，不建议多 worker 写入，会加重锁问题。
- 使用多 worker 前应先迁移 PostgreSQL。
- 后台评分如果用 FastAPI BackgroundTasks，多 worker 下仍不够可靠，建议进一步使用任务队列。

### 2. 使用 Nginx 反向代理

建议部署结构：

```text
浏览器
-> Nginx
   -> /api 转发到 FastAPI
   -> / 前端静态文件 frontend/dist
```

Nginx 负责：

- 静态资源缓存。
- gzip / brotli。
- 请求体大小限制。
- 反向代理超时。
- HTTPS。

建议 Nginx 关键配置：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
    proxy_connect_timeout 10s;
}

location / {
    root /path/to/frontend/dist;
    try_files $uri /index.html;
}
```

如果做流式回复，需要关闭代理缓冲：

```nginx
proxy_buffering off;
```

## 五、LLM 调用稳定性强化

40 人并发时，真正的瓶颈大概率不是 FastAPI，而是 DeepSeek API 的吞吐、速率限制和网络波动。

### 1. 增加 LLM 超时、重试和错误分类

问题位置：

- `backend/services/llm_service.py`

当前 `httpx.AsyncClient(timeout=60.0)` 简单调用，一旦失败直接抛错。

建议：

1. 设置细分 timeout：

   ```python
   timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
   ```

2. 对可重试错误做有限重试：

   - 429 Too Many Requests。
   - 502 / 503 / 504。
   - 网络临时错误。

3. 使用指数退避：

   - 第一次等待 1 秒。
   - 第二次等待 2 秒。
   - 最多重试 2 次。

4. 不要对 401 / 403 重试，这通常是 API Key 或权限问题。

5. 错误返回给前端时要可理解：

   - “AI 服务繁忙，请稍后重试”
   - “AI 服务配置异常，请联系管理员”
   - “网络超时，请重试”

### 2. 设置全局 LLM 并发上限

40 名学生如果同时发送消息，可能瞬间产生 40 个 LLM 请求。应增加进程内并发限制。

简单方案：

在 `llm_service.py` 中使用 `asyncio.Semaphore`：

```python
import asyncio

LLM_CHAT_SEMAPHORE = asyncio.Semaphore(12)
LLM_SCORING_SEMAPHORE = asyncio.Semaphore(3)
```

聊天调用：

```python
async with LLM_CHAT_SEMAPHORE:
    return await _call_llm(...)
```

评分调用：

```python
async with LLM_SCORING_SEMAPHORE:
    return await _call_llm_json(...)
```

注意：

- 多 worker 时，每个 worker 都有自己的 semaphore，总并发 = worker 数 * semaphore 值。
- 生产级更推荐 Redis 队列或集中式限流。

### 3. 区分聊天和评分优先级

课堂体验中，聊天回复优先级高于评分。评分可以后台慢一点，但不能堵住正在训练的学生。

建议：

1. 聊天 LLM 和评分 LLM 使用不同并发池。
2. 聊天请求优先。
3. 评分任务进入队列，按顺序处理。
4. 如果评分排队，前端显示“评分排队中”。

### 4. 降低单次 LLM token 压力

参考 `AI速度优化留言板.md`：

1. 患者回复 `max_tokens` 降到 220 到 300。
2. 对话历史只保留最近 10 到 12 轮。
3. 评分 prompt 压缩。
4. 长对话评分输入裁剪。
5. 患者 prompt 缓存。

这些不仅提升速度，也能提高并发承载能力。

## 六、评分任务必须异步化和队列化

40 人课堂结束时，可能在短时间内触发 40 个评分任务。如果仍在 `end_training()` 中同步评分，系统会非常卡。

### 1. 最低要求：FastAPI BackgroundTasks

适合初步试点。

修改位置：

- `backend/routers/training.py`
- `backend/services/scoring.py`

建议流程：

1. 学生结束训练。
2. 后端立即设置：

   - `status = "scoring"`
   - `end_time = now`

3. 快速返回前端：

   ```json
   {
     "record_id": 1,
     "status": "scoring",
     "message": "训练已结束，评分生成中"
   }
   ```

4. 后台任务重新创建数据库 session。
5. 评分成功后：

   - 保存 score。
   - `status = "completed"`。

6. 评分失败后：

   - `status = "scoring_failed"`。
   - 保存错误摘要。

### 2. 推荐方案：Redis + RQ/Celery

更适合稳定 40 人同时使用。

推荐结构：

```text
FastAPI
-> 收到结束训练请求
-> 写入 training_records.status = scoring
-> 将 record_id 放入 Redis 队列
-> 立即返回

Worker
-> 从队列取 record_id
-> 调用 DeepSeek 评分
-> 保存 score
-> 更新状态 completed / scoring_failed
```

推荐任务：

- `score_training_record(record_id)`
- `retry_score_training_record(record_id)`
- `summarize_record_if_needed(record_id)`

队列建议：

- `chat` 不走队列，保持实时。
- `scoring` 走队列。
- `summary` 可走低优先级队列。

并发建议：

- 评分 worker 并发 2 到 4。
- 课堂结束集中评分时，让任务排队，不要全部同时打到 LLM。

### 3. 评分状态字段

建议给 `training_records` 增加：

- `status`
- `score_error`
- `score_retry_count`
- `score_started_at`
- `score_finished_at`

如果暂时不做迁移，也至少先支持 status：

- `in_progress`
- `scoring`
- `completed`
- `scoring_failed`

### 4. 前端评分轮询

修改：

- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/pages/History.jsx`
- `frontend/src/pages/Admin.jsx`

建议：

1. 结束训练后跳转到记录详情页。
2. 记录详情显示“评分生成中”。
3. 每 2 秒轮询一次。
4. 30 秒后改为每 5 秒。
5. 2 分钟后提示“评分仍在生成，可稍后查看”。
6. 评分失败时显示“重新评分”。

## 七、请求限流和防重复提交

### 1. 聊天接口限流

问题位置：

- `backend/routers/chat.py`

建议策略：

1. 同一个训练记录同一时间只能有 1 个未完成的患者回复。
2. 同一个学生每 2 到 3 秒最多发送 1 条消息。
3. 消息内容最大长度限制，例如 500 字。
4. 空消息和重复消息直接拒绝。

可实现：

- 简单阶段：后端用内存字典记录 `record_id` 的进行中状态。
- 稳定阶段：Redis 分布式锁。

示例逻辑：

```text
record_id 正在生成回复
-> 新请求返回 409
-> 前端提示“上一条回复仍在生成，请稍候”
```

### 2. 前端防重复点击

修改：

- `frontend/src/pages/ChatTraining.jsx`

要求：

1. 发送中禁用发送按钮。
2. 结束训练中禁用结束按钮。
3. 同一条消息失败后允许重试，不要自动重复发送多次。

### 3. 评分防重复

后端 `evaluate_training()` 前检查：

1. 如果已经有 score，不重复评分。
2. 如果 status 为 `scoring`，不重复入队。
3. 如果需要重评，必须通过单独 retry 接口。

## 八、普通 API 性能优化

### 1. 减少 N+1 查询

当前 `get_records()` 中每条记录再查 case、user、score。记录多后会慢。

位置：

- `backend/routers/training.py`

建议：

1. 使用 SQLAlchemy `joinedload` 或显式 join。
2. 一次性加载 record、case、user、score。
3. 教师端分页，不要一次返回所有记录。

推荐新增参数：

```text
GET /api/training/records?page=1&page_size=20&status=completed&student_id=...
```

### 2. 教师端记录分页

40 人多次训练后，记录数会快速上升。教师后台不能无限加载所有记录。

建议：

- `page`
- `page_size`
- `status`
- `case_id`
- `user_id`
- `date_from`
- `date_to`
- `keyword`

前端表格同步支持分页。

### 3. 统计接口优化

位置：

- `backend/routers/stats.py`
- `backend/routers/admin.py`

建议：

1. 使用数据库聚合，不要在 Python 中遍历所有记录。
2. PostgreSQL 下用 `date_trunc` 或按日期聚合。
3. 对教师端统计可以缓存 30 到 60 秒。

### 4. 导出接口后台化

如果记录很多，导出 CSV 可能慢。

短期：

- 40 人规模下可先保留同步导出。

中长期：

- 大量导出改为后台生成文件。
- 前端显示导出任务状态。

## 九、前端稳定性强化

### 1. 网络错误统一处理

当前 `api.js` 只处理 401。

建议增加：

- 408 / timeout：提示网络超时。
- 429：提示请求过快或 AI 服务繁忙。
- 500：提示服务器异常。
- 502 / 503 / 504：提示服务暂时不可用。

不要所有错误都只显示 `alert()`。

### 2. 全局 Toast 和错误状态

参考 `AI界面商业级优化留言板.md`。

必须替换：

- 发送失败 alert。
- 结束训练失败 alert。
- 开始训练失败 alert。
- 导出失败 alert。

### 3. 离线和刷新恢复

训练页需要支持：

1. 页面刷新后重新加载消息。
2. 如果当前记录仍 `in_progress`，允许继续。
3. 如果记录在 `scoring`，显示评分中。
4. 如果网络断开，禁止发送并提示。

### 4. 课堂场景下的前端提示

当系统繁忙时，学生需要知道发生了什么。

建议提示：

- “AI 患者正在回复，请稍候”
- “当前课堂并发较高，回复可能稍慢”
- “评分已进入队列，可稍后在训练记录中查看”
- “上一条消息仍在生成，请勿重复提交”

## 十、部署和运维建议

### 1. 推荐课堂试点部署结构

```text
Nginx
  -> frontend/dist 静态文件
  -> FastAPI API 服务

FastAPI
  -> PostgreSQL
  -> Redis
  -> DeepSeek API

Worker
  -> Redis scoring queue
  -> PostgreSQL
  -> DeepSeek API
```

### 2. Docker 化

建议新增：

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`

服务：

- `frontend-nginx`
- `backend`
- `postgres`
- `redis`
- `worker`

### 3. 环境变量

建议 `.env.example`：

```env
ENV=production
APP_VERSION=1.6-polish
SECRET_KEY=replace-with-random-secret
DATABASE_URL=postgresql+psycopg://virtual_patient:password@postgres:5432/virtual_patient
REDIS_URL=redis://redis:6379/0
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
CORS_ORIGINS=http://localhost:3000,https://your-domain.example
LLM_CHAT_CONCURRENCY=12
LLM_SCORING_CONCURRENCY=3
```

### 4. 进程守护

如果不用 Docker：

- Windows 可使用 NSSM 或计划任务守护。
- Linux 可使用 systemd。

要求：

- 后端崩溃自动重启。
- worker 崩溃自动重启。
- 日志可追踪。

## 十一、日志、监控和告警

### 1. 结构化日志

至少记录：

- 请求路径。
- 状态码。
- 耗时。
- 用户角色。
- record_id。
- LLM 调用耗时。
- LLM 错误类型。
- 评分任务开始和结束。
- 评分失败原因。

不要记录：

- DeepSeek API Key。
- 完整学生对话。
- 完整患者隐私资料。

### 2. 健康检查接口

新增：

```text
GET /health
```

返回：

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "1.6-polish"
}
```

注意：

- health 不应调用 DeepSeek，避免健康检查消耗 LLM。
- 可另加 `/health/deepseek` 供管理员手动检查。

### 3. 管理员可见运行状态

教师后台或管理员页未来可显示：

- 当前进行中训练数。
- 评分中任务数。
- 今日 LLM 调用次数。
- 今日失败次数。
- 平均回复时间。
- 平均评分时间。

这对课堂现场非常有用。

## 十二、压测方案

必须通过压测验证，不要凭感觉认为能支持 40 人。

### 1. 普通 API 压测

工具可选：

- Locust。
- k6。
- wrk。
- JMeter。

推荐 Locust，因为可以模拟登录和业务流程。

### 2. 业务流程压测脚本

模拟 40 名学生：

1. 登录。
2. 获取病例列表。
3. 开始训练。
4. 每隔 20 到 40 秒发送一条消息。
5. 每人发送 8 到 12 条。
6. 集中结束训练。
7. 轮询评分状态。

注意：

- 真实压测如果调用 DeepSeek 会产生费用，并且受限于 API 速率。
- 可以先增加一个 fake LLM 模式。

### 3. Fake LLM 模式

建议在 `backend/config.py` 增加：

```env
LLM_FAKE_MODE=true
```

fake 模式下：

- 患者回复固定延迟 0.5 到 1 秒。
- 评分返回固定合法 JSON。

用途：

- 测后端、数据库、前端和部署承载能力。
- 不消耗 LLM 费用。

之后再用真实 DeepSeek 做小规模验证。

### 4. 压测指标

记录：

- API P50 / P95 / P99。
- 错误率。
- 数据库 CPU / 内存 / 连接数。
- 后端 CPU / 内存。
- Redis 队列长度。
- 评分任务等待时间。
- LLM 调用成功率。
- 前端可感知等待时间。

通过标准：

- 普通 API 错误率低于 1%。
- 聊天请求在 LLM 正常时无大量 500。
- 评分任务可排队完成。
- 数据库没有连接耗尽。
- 后端内存不持续上涨。

## 十三、数据可靠性要求

40 人同时使用时，最怕数据丢失或状态混乱。

必须保证：

1. 学生消息保存成功后，才调用 LLM。
2. 患者回复生成成功后，必须保存。
3. 如果 LLM 回复失败，不能伪造患者回复。
4. 训练结束后不能再发送消息。
5. 评分任务不能重复生成多个 score。
6. 评分失败要有状态，不要让记录永远卡住。
7. 教师端看到的数据应与学生端一致。

建议增加数据库约束：

- `scores.record_id` unique 已有，保留。
- `messages.record_id` 加索引。
- `training_records.status` 最好约束为枚举或应用层校验。

## 十四、实施路线建议

### 第 1 阶段：不改架构的稳定性增强

适合快速试点前完成。

1. LLM 调用增加超时、错误分类和耗时日志。
2. 患者回复降低 `max_tokens`。
3. 对话历史裁剪到最近 10 到 12 轮。
4. 聊天接口防重复提交。
5. 前端发送中状态和失败重试。
6. 结束训练改为评分中状态，至少先不要让用户长时间误以为卡死。

### 第 2 阶段：数据库和评分异步

支撑 40 人的关键阶段。

1. 迁移 PostgreSQL。
2. 加 Alembic。
3. 增加评分状态字段。
4. 使用 BackgroundTasks 或队列异步评分。
5. 前端轮询评分状态。
6. 教师端支持 scoring / scoring_failed 状态。

### 第 3 阶段：队列和 Redis

课堂稳定运行建议完成。

1. 引入 Redis。
2. 评分任务队列化。
3. LLM 聊天和评分并发隔离。
4. 增加 Redis 分布式锁防重复评分。
5. 增加请求频率限制。

### 第 4 阶段：部署生产化

1. Nginx 部署前端和反向代理。
2. FastAPI 多 worker。
3. Worker 单独进程。
4. Docker Compose 或 systemd。
5. 结构化日志。
6. 健康检查。

### 第 5 阶段：压测和课堂演练

1. Fake LLM 压测 40 人。
2. 真实 DeepSeek 小规模压测 5 到 10 人。
3. 真实课堂前做一次 40 人演练。
4. 根据日志调整：

   - LLM 并发数。
   - worker 数。
   - 数据库连接池。
   - 评分队列并发。

## 十五、推荐开发优先级

如果时间有限，按这个顺序做：

1. PostgreSQL 迁移。
2. 评分异步化。
3. LLM 并发限制和超时重试。
4. 聊天接口防重复提交。
5. 前端评分中和错误状态。
6. 记录列表分页。
7. Redis 评分队列。
8. Nginx + 多 worker 部署。
9. Locust 压测。
10. 监控和健康检查。

## 十六、验收清单

系统宣称可以支持 40 人同时使用前，至少完成以下验收：

1. 40 个测试账号可同时登录。
2. 40 人可同时创建训练记录。
3. 40 人在 10 分钟内持续发送消息，后端不崩溃。
4. 同一训练记录不会出现并发重复回复。
5. 训练消息无明显丢失。
6. 30 人以上集中结束训练时，接口快速返回评分中。
7. 评分任务排队后能陆续完成。
8. 教师端可以查看记录，不因数据量增加明显卡顿。
9. 后端日志能看到 LLM 耗时和评分耗时。
10. 数据库连接没有耗尽。
11. 前端在网络慢、AI 服务慢、评分排队时都有明确提示。
12. 压测报告中普通 API P95 达到目标。

## 十七、注意事项

1. 不要在仍使用 SQLite 的情况下宣称系统可稳定支持 40 人并发写入。
2. 不要让评分任务和实时聊天抢同一个无限制 LLM 并发池。
3. 不要同步等待评分完成再返回结束训练接口。
4. 不要让前端在 AI 慢时只显示一个无限 loading。
5. 不要为了并发删除患者角色规则和隐藏信息规则。
6. 不要把完整对话和 API Key 写入日志。
7. 不要在没有压测的情况下上线课堂。
8. 不要一次性引入太多复杂中间件，建议按阶段推进。
9. 如果引入 Redis、PostgreSQL、Nginx、Docker，必须同步更新启动文档。
10. 课堂试点前应准备降级方案：如果 AI 服务异常，允许学生保存训练记录并稍后评分。

## 十八、后续并发稳定性问题记录

后续 AI 或开发者如果发现新的稳定性问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

场景：

- 

问题：

- 

影响范围：

- 

怀疑瓶颈：

- 数据库 / LLM / 后端 worker / 前端 / 网络 / 部署 / 其他

建议修改：

1. 
2. 
3. 

验证方式：

- 
```

