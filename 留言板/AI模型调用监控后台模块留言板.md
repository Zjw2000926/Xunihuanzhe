# AI模型调用监控后台模块留言板

> 目标：在教师管理后台新增“模型调用监控”模块，让教师或管理员能够以可视化方式查看每次大模型调用的模型名称、调用场景、耗时、成功/失败、失败原因、Token 估算和成本估算。  
> 面向后续接手的 AI 或开发者。该模块既服务教学运维，也服务成本控制和课堂稳定性分析。

## 一、当前背景

当前系统已经使用 DeepSeek 完成三类模型调用：

1. 虚拟患者对话。
2. 自动评分。
3. 护理通用问答。

相关文件：

- `backend/services/llm_service.py`
- `backend/services/scoring.py`
- `backend/routers/chat.py`
- `backend/routers/qa.py`
- `backend/routers/training.py`
- `backend/routers/admin.py`
- `backend/routers/stats.py`
- `backend/models.py`
- `backend/schemas.py`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/api.js`
- `frontend/src/pages/Stats.jsx`

当前问题：

1. 没有记录每次模型调用。
2. 不知道每次调用耗时。
3. 不知道失败原因和失败频率。
4. 不知道不同场景的调用成本。
5. 教师后台无法看到 AI 服务是否稳定。
6. 课堂中如果回复变慢，无法判断是后端、网络、模型接口还是评分任务导致。
7. 无法估算一天、一个班级、一堂课的大模型使用成本。

## 二、模块目标

教师管理后台应新增一个模块，例如：

- “AI 调用监控”
- “模型监控”
- “AI 服务状态”

该模块应能展示：

1. 今日模型调用次数。
2. 今日成功率。
3. 平均响应耗时。
4. P95 响应耗时。
5. 今日成本估算。
6. 按调用场景拆分：

   - 虚拟患者对话。
   - 自动评分。
   - 护理问答。

7. 失败调用列表。
8. 失败原因分布。
9. 近期耗时趋势图。
10. Token 与成本趋势。
11. 单条调用明细。

## 三、后端数据模型设计

### 1. 新增模型表 `llm_call_logs`

建议在 `backend/models.py` 新增：

```python
class LLMCallLog(Base):
    __tablename__ = "llm_call_logs"

    id = Column(Integer, primary_key=True, index=True)

    # 调用归属
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("training_records.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)

    # 调用场景：patient_chat / scoring / qa / summary / other
    purpose = Column(String(40), nullable=False, index=True)

    # 模型供应商和模型
    provider = Column(String(40), nullable=False, default="deepseek")
    model = Column(String(80), nullable=False)

    # 请求参数
    temperature = Column(Float, nullable=True)
    max_tokens = Column(Integer, nullable=True)

    # token 统计。若供应商返回 usage，则用真实值；否则用估算值。
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    token_estimated = Column(Integer, nullable=False, default=1)

    # 成本估算，单位建议使用人民币“分”或美元“微单位”，避免浮点误差。
    estimated_cost = Column(Float, nullable=True)
    cost_currency = Column(String(10), nullable=True, default="CNY")

    # 耗时与状态
    latency_ms = Column(Integer, nullable=True, index=True)
    status = Column(String(20), nullable=False, index=True)  # success / failed / timeout / cancelled
    error_type = Column(String(80), nullable=True, index=True)
    error_message = Column(Text, nullable=True)

    # 轻量元数据，不能存完整 prompt 和完整回答
    request_chars = Column(Integer, nullable=True)
    response_chars = Column(Integer, nullable=True)
    metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
```

注意：

- 不要在该表保存完整 Prompt、完整对话、完整病例隐藏信息或 API Key。
- `error_message` 应截断，例如最多 500 字。
- 如果未来使用 PostgreSQL，`metadata` 可继续用 JSON。

### 2. 字段说明

`purpose` 推荐枚举：

- `patient_chat`：虚拟患者回复。
- `scoring`：训练结束自动评分。
- `qa`：护理问答。
- `summary`：未来若增加对话摘要。
- `test`：健康检查或测试调用。

`status` 推荐枚举：

- `success`
- `failed`
- `timeout`
- `rate_limited`
- `auth_error`

`error_type` 推荐：

- `http_401`
- `http_429`
- `http_500`
- `http_502`
- `http_503`
- `http_504`
- `timeout`
- `json_parse_error`
- `network_error`
- `unknown`

## 四、成本估算设计

### 1. 配置模型价格

建议在 `backend/config.py` 增加：

```python
LLM_PRICE_INPUT_PER_1M = float(os.getenv("LLM_PRICE_INPUT_PER_1M", "0"))
LLM_PRICE_OUTPUT_PER_1M = float(os.getenv("LLM_PRICE_OUTPUT_PER_1M", "0"))
LLM_COST_CURRENCY = os.getenv("LLM_COST_CURRENCY", "CNY")
```

`.env.example` 中增加：

```env
LLM_PRICE_INPUT_PER_1M=0
LLM_PRICE_OUTPUT_PER_1M=0
LLM_COST_CURRENCY=CNY
```

说明：

- 因模型价格会变化，不要把具体价格硬编码。
- 价格由部署者根据 DeepSeek 当前计费规则配置。
- 如果不配置价格，成本显示为“未配置”或 0。

### 2. Token 统计优先级

优先顺序：

1. 如果 DeepSeek API 返回 `usage`，使用真实 token：

   - `prompt_tokens`
   - `completion_tokens`
   - `total_tokens`

2. 如果没有 usage，则估算。

粗略估算：

```python
def estimate_tokens_from_text(text: str) -> int:
    # 中文场景粗略估算，保守一些
    return max(1, int(len(text) / 1.5))
```

对于 messages：

```python
request_chars = sum(len(m.get("content", "")) for m in messages)
prompt_tokens = estimate_tokens_from_text(all_prompt_text)
completion_tokens = estimate_tokens_from_text(response_text)
```

注意：

- 估算不是精确成本，只用于趋势和预算参考。
- 前端必须标注“估算”。

### 3. 成本计算

```python
estimated_cost = (
    prompt_tokens / 1_000_000 * LLM_PRICE_INPUT_PER_1M
    + completion_tokens / 1_000_000 * LLM_PRICE_OUTPUT_PER_1M
)
```

如果 token 是估算的：

- `token_estimated = 1`

如果 usage 真实返回：

- `token_estimated = 0`

## 五、封装模型调用日志

### 1. 修改 `call_llm()`

位置：

- `backend/services/llm_service.py`

当前函数：

```python
async def call_llm(messages: list, temperature: float = 0.7, max_tokens: int = 2048) -> str:
```

建议改为支持上下文参数：

```python
async def call_llm(
    messages: list,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    purpose: str = "other",
    user_id: int | None = None,
    record_id: int | None = None,
    case_id: int | None = None,
    db: Session | None = None,
    metadata: dict | None = None,
) -> str:
```

或者更清晰地新增 wrapper：

```python
async def call_llm_with_logging(...):
    ...
```

推荐做法：

- 保留底层 `_call_llm_raw()` 只负责请求模型。
- 新增 `call_llm()` 负责计时、调用、记录日志。

### 2. 记录成功日志

成功时记录：

- `purpose`
- `user_id`
- `record_id`
- `case_id`
- `provider`
- `model`
- `temperature`
- `max_tokens`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `estimated_cost`
- `latency_ms`
- `status = "success"`
- `request_chars`
- `response_chars`
- `metadata`

### 3. 记录失败日志

失败时也必须记录：

- `latency_ms`
- `status`
- `error_type`
- `error_message`
- `purpose`
- `user_id`
- `record_id`
- `case_id`

注意：

- 失败时可能没有 token 和成本。
- `error_message` 截断。
- 记录失败后再抛出异常给业务层。

### 4. 数据库 Session 注意事项

当前 `llm_service.py` 没有直接拿 db session。可选方案：

方案 A：从调用方传入 `db`

- `chat.py` 调用时传 `db`。
- `qa.py` 调用时传 `db`。
- `scoring.py` 调用时传 `db`。

优点：

- 实现简单。

风险：

- 如果后台任务中 session 生命周期不清晰，容易误用关闭的 session。

方案 B：日志函数自己创建 session

新增：

- `backend/services/llm_logging.py`

```python
def save_llm_call_log(...):
    db = SessionLocal()
    try:
        ...
    finally:
        db.close()
```

优点：

- 与业务 session 解耦。

风险：

- 每次调用多一个数据库 session。

课堂规模下建议方案 B 更稳。

## 六、修改各调用场景

### 1. 虚拟患者对话

位置：

- `backend/routers/chat.py`

当前：

```python
reply = await call_llm(llm_messages, temperature=0.7)
```

建议：

```python
reply = await call_llm(
    llm_messages,
    temperature=0.6,
    max_tokens=260,
    purpose="patient_chat",
    user_id=current_user.id,
    record_id=record_id,
    case_id=record.case_id,
    metadata={"message_count": len(messages)}
)
```

### 2. 自动评分

位置：

- `backend/services/scoring.py`

建议：

```python
result = await call_llm_json(
    scoring_messages,
    temperature=0.2,
    max_tokens=4096,
    purpose="scoring",
    user_id=record.user_id,
    record_id=record_id,
    case_id=record.case_id,
    metadata={"conversation_message_count": len(messages)}
)
```

如果 `call_llm_json()` 内部调用 `call_llm()`，需要把这些参数透传进去。

### 3. 护理问答

位置：

- `backend/routers/qa.py`

建议：

```python
answer = await call_llm(
    messages,
    temperature=0.7,
    max_tokens=1024,
    purpose="qa",
    user_id=current_user.id,
    metadata={"question_chars": len(req.question)}
)
```

## 七、后端统计接口设计

### 1. 新增路由

建议新增文件：

- `backend/routers/llm_monitoring.py`

并在 `backend/main.py` 中 include。

```python
from routers import llm_monitoring
app.include_router(llm_monitoring.router)
```

路由前缀：

```python
router = APIRouter(prefix="/api/admin/llm", tags=["模型调用监控"])
```

权限：

- 全部接口必须 `Depends(require_teacher)`。

### 2. 总览接口

```text
GET /api/admin/llm/overview?range=today
```

支持 range：

- `today`
- `7d`
- `30d`
- `all`

返回示例：

```json
{
  "total_calls": 152,
  "success_calls": 145,
  "failed_calls": 7,
  "success_rate": 0.954,
  "avg_latency_ms": 4260,
  "p95_latency_ms": 9200,
  "total_tokens": 280000,
  "estimated_cost": 1.82,
  "cost_currency": "CNY",
  "token_estimated": true
}
```

### 3. 按场景统计

```text
GET /api/admin/llm/by-purpose?range=7d
```

返回：

```json
[
  {
    "purpose": "patient_chat",
    "calls": 120,
    "success_rate": 0.97,
    "avg_latency_ms": 3800,
    "estimated_cost": 0.9
  },
  {
    "purpose": "scoring",
    "calls": 20,
    "success_rate": 0.9,
    "avg_latency_ms": 18000,
    "estimated_cost": 0.7
  }
]
```

### 4. 趋势接口

```text
GET /api/admin/llm/trends?range=7d&bucket=hour
```

bucket：

- `hour`
- `day`

返回：

```json
[
  {
    "time": "2026-05-26 09:00",
    "calls": 18,
    "failures": 1,
    "avg_latency_ms": 4200,
    "estimated_cost": 0.12
  }
]
```

SQLite 阶段可用 Python 聚合；PostgreSQL 阶段建议用 SQL 聚合。

### 5. 失败分布接口

```text
GET /api/admin/llm/errors?range=7d
```

返回：

```json
[
  {"error_type": "timeout", "count": 3},
  {"error_type": "http_429", "count": 2},
  {"error_type": "json_parse_error", "count": 1}
]
```

### 6. 调用明细列表

```text
GET /api/admin/llm/logs?page=1&page_size=20&purpose=patient_chat&status=failed
```

支持过滤：

- `purpose`
- `status`
- `user_id`
- `record_id`
- `date_from`
- `date_to`
- `min_latency_ms`

返回：

```json
{
  "items": [
    {
      "id": 1,
      "created_at": "...",
      "purpose": "patient_chat",
      "model": "deepseek-chat",
      "status": "success",
      "latency_ms": 3800,
      "total_tokens": 900,
      "estimated_cost": 0.006,
      "user_display_name": "学生1",
      "record_id": 12,
      "error_type": null
    }
  ],
  "total": 152,
  "page": 1,
  "page_size": 20
}
```

### 7. 单条详情接口

```text
GET /api/admin/llm/logs/{log_id}
```

返回：

- 基本信息。
- 调用场景。
- 耗时。
- token。
- 成本。
- 错误摘要。
- 关联用户、训练记录、病例。

注意：

- 不返回完整 prompt。
- 不返回完整模型回复。

## 八、前端 API 封装

修改：

- `frontend/src/api.js`

新增：

```js
export function getLLMOverview(range = "today") {
  return api.get(`/admin/llm/overview?range=${range}`);
}

export function getLLMByPurpose(range = "today") {
  return api.get(`/admin/llm/by-purpose?range=${range}`);
}

export function getLLMTrends(range = "7d", bucket = "hour") {
  return api.get(`/admin/llm/trends?range=${range}&bucket=${bucket}`);
}

export function getLLMErrors(range = "7d") {
  return api.get(`/admin/llm/errors?range=${range}`);
}

export function getLLMLogs(params = {}) {
  return api.get("/admin/llm/logs", { params });
}

export function getLLMLogDetail(id) {
  return api.get(`/admin/llm/logs/${id}`);
}
```

## 九、教师后台 UI 设计

当前教师后台：

- `frontend/src/pages/Admin.jsx`

建议新增 Tab：

- `AI调用监控`

如果后续拆分 Admin，建议新增：

- `frontend/src/components/teacher/LLMMonitorTab.jsx`

### 1. 页面结构

推荐布局：

```text
顶部：
- 标题：AI 调用监控
- 时间范围：今日 / 近7天 / 近30天 / 全部
- 刷新按钮

第一行指标卡：
- 总调用次数
- 成功率
- 平均耗时
- P95耗时
- 估算成本

第二行图表：
- 调用量与失败趋势折线图
- 平均耗时趋势图

第三行：
- 按场景调用分布
- 失败原因分布

底部：
- 调用明细表格
```

### 2. 指标卡

建议使用：

- `Activity` 图标：总调用。
- `CheckCircle`：成功率。
- `Clock`：平均耗时。
- `TrendingUp`：P95。
- `Wallet` 或 `CircleDollarSign`：成本估算。

注意：

- 成本未配置时显示“未配置价格”。
- Token 为估算时显示“估算”标签。

### 3. 趋势图

项目已有 `recharts`，可直接使用：

- `LineChart`
- `BarChart`
- `PieChart` 或 `BarChart`

建议：

- 调用量：柱状图。
- 失败数：红色折线。
- 平均耗时：蓝色折线。
- 成本：绿色或青色。

### 4. 按场景分布

显示：

- 虚拟患者对话。
- 自动评分。
- 护理问答。
- 其他。

每个场景展示：

- 调用次数。
- 成功率。
- 平均耗时。
- 成本。

### 5. 调用明细表

列建议：

- 时间。
- 场景。
- 用户。
- 记录 ID。
- 模型。
- 状态。
- 耗时。
- Token。
- 成本。
- 失败原因。
- 操作。

过滤器：

- 时间范围。
- 场景。
- 状态。
- 最小耗时。
- 用户关键词。

操作：

- 查看详情。
- 跳转训练记录。

### 6. 单条详情抽屉或弹窗

显示：

- 调用 ID。
- 调用时间。
- 用户。
- 训练记录。
- 病例。
- 场景。
- 模型。
- temperature。
- max_tokens。
- 请求字符数。
- 响应字符数。
- token。
- 成本。
- 耗时。
- 状态。
- 错误类型。
- 错误摘要。

不要显示：

- API Key。
- 完整 prompt。
- 完整患者回复。
- 完整学生对话。

## 十、权限与隐私要求

1. 只有教师可以访问该模块。
2. 如果未来区分管理员和普通教师，建议只有管理员能看成本和错误详情。
3. 不在前端展示完整 prompt 和完整模型回答。
4. 不展示 API Key。
5. 错误信息要截断并脱敏。
6. 导出监控日志前必须写审计日志。

## 十一、性能与存储策略

### 1. 日志量估算

40 名学生同时训练：

- 每人 10 轮对话：400 次 `patient_chat`。
- 每人 1 次评分：40 次 `scoring`。
- 若 QA 使用频繁，另有几十次。

一天可能几百到几千条日志。这个量不大，但仍建议：

- 给 `created_at`、`purpose`、`status` 建索引。
- 明细接口分页。
- 趋势接口聚合查询。

### 2. 日志保留

建议保留：

- 明细日志：90 天。
- 聚合指标：长期保留。

未来可新增定时任务：

- 删除 90 天前明细。
- 保留日级汇总。

### 3. 聚合表，可选

如果日志很多，可新增：

- `llm_daily_metrics`

字段：

- date。
- purpose。
- total_calls。
- success_calls。
- failed_calls。
- avg_latency_ms。
- p95_latency_ms。
- total_tokens。
- estimated_cost。

40 人试点阶段可以先不做，直接查 `llm_call_logs`。

## 十二、失败原因分类

建议在 `llm_service.py` 中统一异常分类。

示例：

```python
def classify_llm_error(exc) -> tuple[str, str]:
    if isinstance(exc, httpx.TimeoutException):
        return "timeout", "模型服务响应超时"
    if isinstance(exc, httpx.ConnectError):
        return "network_error", "无法连接模型服务"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 401:
            return "auth_error", "模型 API Key 无效或未授权"
        if status == 429:
            return "rate_limited", "模型服务请求过于频繁"
        return f"http_{status}", f"模型服务返回 HTTP {status}"
    return "unknown", str(exc)[:200]
```

前端展示中文文案：

- `timeout`：模型响应超时。
- `rate_limited`：模型服务限流。
- `auth_error`：模型认证失败，请检查配置。
- `json_parse_error`：评分结果解析失败。
- `network_error`：网络连接失败。

## 十三、审计与导出

该模块未来可支持导出监控数据，但要谨慎。

如果新增：

```text
GET /api/admin/llm/export
```

要求：

1. 仅教师或管理员。
2. 写入 `AuditLog`。
3. 不导出完整 prompt。
4. 不导出完整 error stack。
5. 只导出聚合或脱敏明细。

## 十四、实施顺序

### 第 1 阶段：后端日志表和基础记录

1. 新增 `LLMCallLog` 模型。
2. 新增成本配置。
3. 新增 token 估算函数。
4. 修改 `call_llm()`，记录成功和失败。
5. 在 chat、qa、scoring 调用中传入 `purpose`、`user_id`、`record_id`、`case_id`。

### 第 2 阶段：统计 API

1. 新增 `routers/llm_monitoring.py`。
2. 实现 overview。
3. 实现 by-purpose。
4. 实现 trends。
5. 实现 errors。
6. 实现 logs 分页列表。
7. 所有接口加 `require_teacher`。

### 第 3 阶段：教师后台 UI

1. `api.js` 增加接口封装。
2. `Admin.jsx` 增加 “AI调用监控” Tab。
3. 新建 `LLMMonitorTab.jsx`。
4. 增加指标卡。
5. 增加趋势图。
6. 增加失败原因图。
7. 增加调用明细表。

### 第 4 阶段：完善筛选和详情

1. 增加时间范围切换。
2. 增加 purpose/status 过滤。
3. 增加单条详情弹窗或抽屉。
4. 增加跳转到训练记录。
5. 增加失败日志重点提示。

### 第 5 阶段：优化与运维

1. 增加日志保留策略。
2. 增加日级聚合，若需要。
3. 增加导出，若需要。
4. 接入审计日志。
5. 增加压测时监控验证。

## 十五、验证清单

### 1. 后端验证

1. 学生发送一次训练消息，`llm_call_logs` 增加一条 `patient_chat`。
2. 学生问一次 QA，增加一条 `qa`。
3. 结束训练评分，增加一条 `scoring`。
4. 模型失败时也写入 failed 日志。
5. 日志中没有 API Key。
6. 日志中没有完整 prompt。

### 2. API 验证

1. 教师可访问 `/api/admin/llm/overview`。
2. 学生访问返回 403。
3. 趋势接口有数据。
4. 明细接口分页正常。
5. 过滤 purpose/status 正常。

### 3. 前端验证

1. 教师后台出现 “AI调用监控” Tab。
2. 指标卡显示总调用、成功率、耗时、成本。
3. 图表能显示最近趋势。
4. 失败原因分布能显示。
5. 明细表能分页和筛选。
6. 成本未配置时显示友好提示。
7. Token 估算时有“估算”标记。

### 4. 性能验证

1. 1000 条日志时页面加载不卡顿。
2. 明细表分页查询不一次性拉全量。
3. 聚合接口响应可接受。

## 十六、注意事项

1. 不要记录完整 Prompt、完整病例隐藏信息、完整学生对话。
2. 不要记录 API Key。
3. 不要把成本估算当成真实账单，前端应标注“估算”。
4. 不要让学生访问该模块。
5. 不要因为记录日志导致主流程失败。日志保存失败时应记录后端日志，但不应阻断学生对话。
6. 如果数据库压力增大，日志写入可以异步化或降级。
7. 如果未来多模型供应商，`provider` 和 `model` 必须准确记录。
8. 如果价格变化，只改环境变量，不改代码。

## 十七、后续模型监控问题记录

后续 AI 或开发者如果发现新的监控问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

问题：

- 

涉及范围：

- 日志记录 / 成本估算 / 统计接口 / 教师后台 UI / 权限 / 性能 / 其他

现象：

- 

建议修改：

1. 
2. 
3. 

验证方式：

- 
```

