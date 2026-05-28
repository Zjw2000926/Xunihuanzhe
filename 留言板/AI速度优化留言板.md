# AI速度优化留言板

> 目标：优化虚拟患者系统的回复速度和自动评分速度。  
> 面向后续接手的 AI 或开发者。请优先保证训练体验稳定，不要为了追求速度牺牲患者角色一致性、评分质量和数据可靠性。

## 一、当前速度瓶颈判断

当前系统中，慢主要来自两类 LLM 调用：

1. 虚拟患者回复。
2. 训练结束后的自动评分。

相关文件：

- `backend/services/llm_service.py`
- `backend/services/scoring.py`
- `backend/routers/chat.py`
- `backend/routers/training.py`
- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/components/ScoreCard.jsx`
- `frontend/src/pages/RecordDetail.jsx`

当前流程大致是：

```text
学生发送消息
-> 后端保存学生消息
-> 查询该训练全部历史消息
-> 拼接完整 system prompt + 全量对话历史
-> 调用 DeepSeek
-> 等待完整回复返回
-> 保存患者回复
-> 前端一次性显示回复
```

训练结束评分流程大致是：

```text
学生点击结束训练
-> 后端将记录改为 completed
-> 立即同步调用评分 LLM
-> 等待评分 JSON 返回
-> 保存 score
-> 前端等待接口结束
-> 显示评分弹窗
```

主要问题：

1. 每轮对话都把完整历史消息发给 LLM，训练越长越慢。
2. 患者 system prompt 较长，且每次请求都重复发送。
3. 回复没有流式输出，用户只能等完整回答回来。
4. 评分在结束训练接口中同步执行，前端会长时间卡在“评分中”。
5. 评分 prompt 很长，且包含完整对话，token 使用量大。
6. 评分 JSON 容错和重试机制不足，失败后用户体验差。
7. 没有队列、后台任务、状态轮询或评分重试。
8. 没有记录 LLM 调用耗时，无法量化优化效果。

## 二、先建立速度指标

在优化前，必须先测量，否则无法判断优化是否有效。

建议新增日志指标：

1. 虚拟患者单次回复耗时。
2. 护理问答单次回复耗时。
3. 自动评分耗时。
4. prompt token 估算长度。
5. 返回内容长度。
6. LLM 请求失败次数。
7. 评分重试次数。

推荐在 `backend/services/llm_service.py` 里对 `call_llm()` 增加简单计时。

示例思路：

```python
import time
import logging

logger = logging.getLogger(__name__)

start = time.perf_counter()
try:
    ...
finally:
    elapsed = time.perf_counter() - start
    logger.info("llm_call_elapsed=%.2fs model=%s max_tokens=%s", elapsed, DEEPSEEK_MODEL, max_tokens)
```

注意：

- 不要把 API Key 打进日志。
- 不要把完整病人信息和学生对话全文打进生产日志。
- 如果要记录 prompt 长度，可记录字符数或估算 token 数，不记录原文。

建议目标：

- 虚拟患者首字出现时间：1 到 3 秒内。
- 虚拟患者完整回复：3 到 8 秒内。
- 自动评分：后台 10 到 30 秒内完成，前端不阻塞训练结束。
- QA 问答：3 到 8 秒内。

## 三、优化虚拟患者回复速度

### 1. 缩短患者回复 max_tokens

问题位置：

- `backend/services/llm_service.py`
- `backend/routers/chat.py`

当前 `call_llm()` 默认 `max_tokens=2048`，但患者回复规则要求每次 50 到 150 字。2048 明显偏大。

建议修改：

1. 保留 `call_llm()` 默认值。
2. 在 `chat.py` 调用患者回复时显式传入较小值。

推荐：

```python
reply = await call_llm(llm_messages, temperature=0.7, max_tokens=300)
```

进一步建议：

- 如果患者回复经常过长，可改为 `max_tokens=220`。
- QA 问答可保留 800 到 1024。
- 评分可保留 3000 到 4096。

验证方式：

- 对同一条问题测试 5 次，记录平均响应时间。
- 确认患者回答没有被截断。

### 2. 缩短患者 system prompt

问题位置：

- `backend/services/llm_service.py`
- `build_patient_system_prompt()`

当前 system prompt 很完整，但每一轮都重复发送，增加 token 和延迟。

建议改法：

1. 保留关键约束：

   - 只能扮演患者。
   - 只能回答被问到的信息。
   - 不能主动泄露隐藏信息。
   - 不编造病例外内容。
   - 每次回答 50 到 150 字。

2. 合并重复表达，减少教学解释性语言。
3. 病例字段只保留 LLM 需要扮演患者的信息。
4. 不要把评分标准放进患者 prompt。

压缩方向示例：

```text
你是护理病史采集训练中的虚拟患者，只能以患者身份回答。
根据以下病例资料回答学生问题。未被问到的信息不要主动透露；隐藏信息只有被明确问到才透露。
如果资料中没有相关内容，说“不太清楚/记不清了”，不要编造。
每次用中文自然回答，50-150字。
```

注意：

- 压缩 prompt 后必须测试患者是否仍然“被动回答”。
- 不能为了快让患者主动给完整病史，这会破坏训练价值。

### 3. 对话历史裁剪

问题位置：

- `backend/routers/chat.py`

当前每次都查询并发送该训练的全部消息。长对话会越来越慢。

建议新增历史裁剪策略。

简单版：

1. 最近 8 到 12 轮完整对话直接发送。
2. 更早的对话不再逐条发送。

示例逻辑：

```python
messages = db.query(Message).filter(...).order_by(Message.created_at).all()
recent_messages = messages[-20:]
```

其中 20 条消息大约等于 10 轮问答。

更好版：

1. 为每条训练记录维护一个 `conversation_summary`。
2. 当消息超过一定数量时，把早期对话总结成简短摘要。
3. 后续请求发送：

   - system prompt。
   - 早期摘要。
   - 最近 8 到 12 轮消息。

可能需要新增字段：

- `training_records.conversation_summary`
- 或新表 `record_summaries`

短期不想改表时，可先只裁剪最近消息。

注意：

- 如果只裁剪最近消息，患者可能忘记早期已经回答过的信息。
- 可以在裁剪后加入一条 system 或 assistant 摘要来保留关键已透露信息。

推荐摘要内容：

- 已问过哪些主题。
- 患者已经透露的关键病史。
- 学生尚未问到的隐藏信息不要放进摘要。

### 4. 增加已透露信息摘要

目的：

- 减少完整历史传输。
- 保持患者回答前后一致。

建议方式：

1. 后端每隔若干轮生成一次摘要。
2. 摘要只包含“学生已经问到，患者已经回答”的内容。
3. 摘要不包含未问到的隐藏信息。

可新增函数：

- `build_conversation_summary_prompt()`
- `update_conversation_summary(record_id)`

也可以先用非 LLM 简单规则：

- 不做自动摘要。
- 只保留最近 12 轮。
- 把病例资料作为事实来源，允许患者根据病例资料继续回答。

### 5. 使用流式响应

目标：

- 即使完整回复仍需数秒，也让用户 1 到 2 秒内看到首字。

后端建议：

1. 在 `llm_service.py` 新增 `call_llm_stream()`。
2. 使用 DeepSeek / OpenAI 兼容接口的流式能力时，先核对官方文档，确认请求参数和响应格式。
3. 新增接口：

   - `POST /api/chat/{record_id}/message/stream`

4. 返回 `StreamingResponse` 或 SSE。
5. 流式结束后，把完整患者回复保存到数据库。

前端建议：

1. 在 `ChatTraining.jsx` 中新增流式发送逻辑。
2. 学生消息立即显示。
3. 患者消息先创建一个空 bubble。
4. 随 chunk 逐步追加内容。
5. 流结束后固定消息内容。
6. 失败时展示“回复失败，可重试”。

注意：

- 流式响应会让代码复杂一些，但对体感速度提升最大。
- 保存数据库时必须保存完整文本，不要保存半截。
- 如果中途失败，要标记该患者回复失败，允许重新发送或重试。

### 6. 前端增加“即时反馈”状态

即使后端还没做流式，也可以改善体感。

修改位置：

- `frontend/src/pages/ChatTraining.jsx`

建议：

1. 学生发送后立即显示学生消息。
2. 患者侧显示更自然的 typing 状态。
3. 顶部显示“患者正在思考...”。
4. 超过 8 秒显示“仍在生成，请稍候”。
5. 超过 30 秒显示“生成较慢，可稍后重试”。

注意：

- 这不能真正加速，但能降低用户焦虑。
- 真正加速仍应做 max_tokens、上下文裁剪和流式输出。

## 四、优化自动评分速度

### 1. 评分改为后台执行

当前问题：

- `end_training()` 中同步等待评分完成。
- 用户点击结束后必须等评分接口完全返回。

问题位置：

- `backend/routers/training.py`
- `backend/services/scoring.py`
- `frontend/src/pages/ChatTraining.jsx`

推荐改法：

1. 点击结束训练后，后端立即保存：

   - `status = "scoring"`
   - `end_time = now`

2. 后端启动后台评分任务。
3. `end_training()` 立即返回：

   ```json
   {
     "message": "训练已结束，评分生成中",
     "record_id": 123,
     "status": "scoring"
   }
   ```

4. 前端跳转到记录详情或显示评分生成中页面。
5. 前端轮询 `GET /api/training/records/{record_id}`。
6. 当 `score` 出现且 `status = completed` 时显示评分。

FastAPI 简单版：

```python
from fastapi import BackgroundTasks

@router.post("/{record_id}/end")
async def end_training(..., background_tasks: BackgroundTasks):
    ...
    record.status = "scoring"
    record.end_time = datetime.now(timezone.utc)
    db.commit()
    background_tasks.add_task(run_scoring_task, record.id)
    return {"message": "训练已结束，评分生成中", "record_id": record.id, "status": "scoring"}
```

注意：

- BackgroundTasks 适合单机试点。
- 生产环境建议 Celery / RQ / Dramatiq / Arq 这类任务队列。
- 后台任务不要复用已经关闭的 db session，应在任务里重新创建 Session。

### 2. 增加评分状态

当前 `training_records.status` 只有：

- `in_progress`
- `completed`

建议扩展：

- `in_progress`
- `scoring`
- `completed`
- `scoring_failed`

前端显示：

- `in_progress`：进行中。
- `scoring`：评分中。
- `completed`：已完成。
- `scoring_failed`：评分失败。

涉及文件：

- `backend/models.py`
- `backend/routers/training.py`
- `frontend/src/pages/History.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/DashboardHome.jsx`

### 3. 增加评分失败原因和重试次数

建议数据库字段：

- `training_records.score_error`
- `training_records.score_retry_count`

如果暂时不改数据库，也可以先把错误只写日志，但商业级建议入库。

推荐行为：

1. 评分成功：

   - `status = completed`
   - `score_error = null`

2. 评分失败：

   - `status = scoring_failed`
   - `score_error = 简短错误信息`
   - `score_retry_count += 1`

3. 前端提供“重新评分”按钮。

新增接口建议：

- `POST /api/training/{record_id}/score/retry`

权限：

- 学生只能重试自己的训练。
- 教师可以重试所有训练。

### 4. 压缩评分 prompt

问题位置：

- `backend/services/llm_service.py`
- `build_scoring_prompt()`

当前评分 prompt 很长，包含大量评分标准文本和完整 JSON 示例。评分慢的重要原因之一就是 prompt 太长。

建议压缩：

1. 评分标准保留，但减少解释性语言。
2. 19 项 item 名称保留。
3. JSON 示例保留结构，但去掉冗长中文说明。
4. `suggestions` 字数可以从 200-350 字降低到 120-220 字。
5. `missed_content` 只要求列出 3 到 8 条关键漏问。

注意：

- 不要把评分标准压得过短，否则评分稳定性会下降。
- 可先保留完整 prompt 做基准，再 A/B 测试压缩 prompt。

### 5. 评分对话内容裁剪

评分不一定需要完整逐字对话。

建议方案：

1. 如果对话少于 40 条消息，仍使用完整对话。
2. 如果超过 40 条，先生成或使用训练摘要。
3. 评分输入包括：

   - 完整开场问候。
   - 学生所有提问的列表。
   - 患者关键回答摘要。
   - 最近若干轮完整对话。

可新增函数：

- `build_scoring_conversation_text(messages)`

示例策略：

```text
学生提问清单：
1. ...
2. ...

患者已透露关键信息：
- ...

最近 10 轮完整对话：
...
```

好处：

- 减少 token。
- 评分更聚焦“学生问了什么”。

风险：

- 摘要质量差会影响评分。
- 对沟通技能评分可能需要完整上下文，因此至少保留开头和结尾对话。

建议保留：

- 最前 4 轮。
- 最后 6 轮。
- 中间学生提问清单。
- 已采集信息摘要。

### 6. 评分拆分并行化

当前一次 LLM 完成全部 19 项评分。

可选优化：

1. 一个 LLM 调用评分沟通技能 14 项。
2. 另一个 LLM 调用评分病史采集 5 项。
3. 后端并发执行两个评分任务。
4. 合并结果。

优点：

- 单个 prompt 更短。
- 如果 LLM 服务支持并发，可能总耗时下降。

缺点：

- 成本可能增加。
- 两个模型调用都要成功。
- 结果一致性需要校验。

建议：

- 先做后台评分和 prompt 压缩。
- 如果仍然慢，再考虑拆分并行评分。

### 7. 评分结构校验和自动修复

速度优化不能只看快，评分失败重试会更慢。因此必须提高一次成功率。

建议在 `scoring.py` 中新增：

- `validate_score_result(result)`
- `normalize_score_result(result)`

功能：

1. 缺失字段时补默认值。
2. item 分数转为 int。
3. item 分数限制在 1 到 3。
4. 分类分数按 item 求和。
5. total_score 按分类求和。
6. max 固定为 42 和 15。

这样可以减少因为小格式问题导致的失败重试。

## 五、并发和队列方案

### 1. 试点阶段：FastAPI BackgroundTasks

适用：

- 单机部署。
- 同时使用人数不多。
- 评分任务不需要跨进程可靠恢复。

优点：

- 改动小。
- 不需要 Redis。

风险：

- 服务重启会丢任务。
- 多 worker 部署时任务状态管理复杂。

### 2. 稳定阶段：任务队列

推荐：

- Celery + Redis
- RQ + Redis
- Dramatiq + Redis
- Arq + Redis

建议任务：

- `score_training_record(record_id)`
- `summarize_training_record(record_id)`

数据库状态作为任务结果来源，前端只查数据库，不直接依赖队列返回。

### 3. 限制并发，避免 LLM 服务过载

建议：

1. 对同一用户限制同时训练请求。
2. 对评分任务设置并发上限。
3. 对 QA 设置频率限制。
4. 对失败任务做指数退避重试。

示例策略：

- 单用户每 3 秒最多 1 次聊天请求。
- 单训练记录同一时刻只能有 1 个评分任务。
- 评分失败最多自动重试 1 次，之后人工点击重试。

## 六、前端体验优化

### 1. 聊天页体感速度

修改文件：

- `frontend/src/pages/ChatTraining.jsx`

建议：

1. 发送消息后立即显示学生消息。
2. 患者回复区域立即出现 typing bubble。
3. 如果后端支持流式，逐字追加。
4. 如果后端不支持流式，至少显示分阶段提示：

   - 0 到 8 秒：患者正在输入。
   - 8 到 20 秒：仍在生成回复。
   - 20 秒以上：网络较慢，请稍候。

5. 发送失败时，学生消息旁显示“重试”。

### 2. 评分页体感速度

训练结束后不要让用户一直停在按钮 loading。

建议流程：

1. 用户点击结束训练。
2. 前端显示确认弹窗。
3. 确认后调用结束接口。
4. 接口快速返回 `scoring`。
5. 前端进入“评分生成中”视图。
6. 轮询记录详情。
7. 评分完成后自动展示报告。

轮询建议：

- 每 2 秒请求一次。
- 30 秒后改为每 5 秒一次。
- 2 分钟后提示“评分仍在生成，可稍后在训练记录中查看”。

### 3. 历史记录状态展示

修改文件：

- `frontend/src/pages/History.jsx`
- `frontend/src/pages/Admin.jsx`

状态 Badge：

- 进行中：蓝色。
- 评分中：琥珀色。
- 已完成：绿色。
- 评分失败：红色。

评分中记录操作：

- 查看进度。
- 暂不显示分数。

评分失败记录操作：

- 查看错误。
- 重新评分。

## 七、可考虑的缓存策略

### 1. 病例 prompt 缓存

`build_patient_system_prompt(case_data)` 每次都重新拼接。拼接本身不是主要瓶颈，但可以缓存。

建议：

- 以 `case_id` 或病例更新时间作为 key。
- 进程内字典缓存即可。

注意：

- 如果后续支持病例编辑，病例更新后必须清缓存。

### 2. QA 问答缓存

护理通用问答有很多重复问题。

可以缓存：

- “如何询问既往病史？”
- “糖尿病患者病史采集重点？”
- “如何评估疼痛程度？”

建议：

- 用问题文本归一化后作为 key。
- 缓存 1 到 7 天。
- 仅缓存通用 QA，不缓存训练对话。

不要缓存：

- 虚拟患者对话。
- 自动评分结果，除非同一 record_id 已经评分过。

### 3. 防止重复评分

在 `evaluate_training()` 前检查：

- 如果该 `record_id` 已有 score，直接返回已有 score。
- 除非明确调用 retry 并要求覆盖。

这样可避免用户重复点击导致重复花费时间和费用。

## 八、后端接口建议

### 1. 聊天流式接口

新增：

```text
POST /api/chat/{record_id}/message/stream
```

用途：

- 提升首字响应速度。

响应：

- SSE 或 chunked text。

完成后：

- 保存完整患者消息。

### 2. 结束训练接口异步化

修改：

```text
POST /api/training/{record_id}/end
```

返回：

```json
{
  "message": "训练已结束，评分生成中",
  "record_id": 1,
  "status": "scoring"
}
```

### 3. 评分状态查询

已有：

```text
GET /api/training/records/{record_id}
```

可继续复用。

也可新增轻量接口：

```text
GET /api/training/{record_id}/score/status
```

返回：

```json
{
  "record_id": 1,
  "status": "scoring",
  "score_id": null,
  "score_error": null
}
```

### 4. 重试评分接口

新增：

```text
POST /api/training/{record_id}/score/retry
```

行为：

- 如果当前无评分或评分失败，重新进入 `scoring`。
- 如果已有评分，默认不覆盖，除非传 `force=true` 且用户为教师。

## 九、建议实施顺序

### 第 1 阶段：低风险快速收益

1. 给 LLM 调用增加耗时日志。
2. 患者回复 `max_tokens` 降到 220 到 300。
3. QA 回复 `max_tokens` 控制在 800 到 1024。
4. 对话历史只发送最近 10 到 12 轮。
5. 前端优化 typing 和超时提示。

预期收益：

- 改动小。
- 对话速度明显改善。
- 不改变数据库结构。

### 第 2 阶段：评分异步化

1. 增加 `scoring` 和 `scoring_failed` 状态。
2. `end_training()` 改为快速返回。
3. 使用 BackgroundTasks 后台评分。
4. 前端轮询评分状态。
5. 历史记录和记录详情支持评分中、评分失败。

预期收益：

- 结束训练不再卡死等待。
- 用户体验显著改善。

### 第 3 阶段：评分稳定和提速

1. 压缩评分 prompt。
2. 增加评分 JSON 校验和归一化。
3. 增加评分失败重试接口。
4. 防止重复评分。
5. 长对话评分输入裁剪。

预期收益：

- 评分更快。
- 失败率降低。
- 成本下降。

### 第 4 阶段：流式聊天

1. 新增后端流式 LLM 调用。
2. 新增流式聊天接口。
3. 前端逐字显示患者回复。
4. 完善中断和失败重试。

预期收益：

- 首字响应时间大幅下降。
- 训练对话更自然。

### 第 5 阶段：生产级队列和并发控制

1. 引入 Redis。
2. 引入任务队列。
3. 评分任务队列化。
4. 限制并发和频率。
5. 增加任务监控。

预期收益：

- 多人试点更稳定。
- 防止 LLM 调用阻塞主服务。

## 十、验证方法

### 1. 对话速度测试

测试账号：

- `student1 / 123456`

测试方法：

1. 选择病例。
2. 连续发送 10 条常见问诊问题。
3. 记录每次：

   - 点击发送时间。
   - 首字出现时间，若流式。
   - 完整回复时间。
   - 是否失败。

目标：

- 非流式完整回复平均 3 到 8 秒。
- 流式首字 1 到 3 秒。

### 2. 评分速度测试

测试方法：

1. 准备 3 条训练记录：

   - 短对话：5 轮。
   - 中对话：12 轮。
   - 长对话：25 轮以上。

2. 分别结束训练。
3. 记录：

   - end 接口返回时间。
   - 后台评分完成时间。
   - 是否一次成功。
   - score JSON 是否完整。

目标：

- end 接口 1 秒内返回。
- 后台评分 10 到 30 秒内完成。
- 评分失败时状态正确显示。

### 3. 前端体验测试

必须检查：

- 发送消息期间按钮不会重复提交。
- 生成中状态不会导致布局跳动。
- 结束训练后不会长时间卡死。
- 评分中刷新页面后仍能看到状态。
- 评分完成后自动显示报告。
- 评分失败时能重试。

## 十一、注意事项

1. 不要为了速度删除患者被动回答、隐藏信息保护等核心规则。
2. 不要让患者 prompt 泄露诊断或隐藏信息给学生端。
3. 不要在日志中记录 API Key。
4. 不要把完整对话长期写入普通日志，涉及教学和隐私风险。
5. 不要在同步请求中做长时间评分。
6. 不要重复评分同一记录，除非用户明确点击重试。
7. 流式响应保存数据库时必须保存完整最终文本。
8. BackgroundTasks 不是生产级可靠队列，生产部署前应换成任务队列。
9. 如果引入 Redis 或 Celery，要同步更新启动文档。
10. 所有速度优化后都要重新验证评分质量，不要只看耗时。

## 十二、后续速度问题记录

后续 AI 或开发者如果发现新的速度问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

问题：

- 

涉及接口：

- 

当前耗时：

- 

建议优化：

1. 
2. 
3. 

验证结果：

- 
```

