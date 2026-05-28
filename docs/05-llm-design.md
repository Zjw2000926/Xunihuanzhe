# 05 — LLM提示词与评分设计

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

## LLM 配置

| 配置项 | 值 | 环境变量 |
|--------|-----|----------|
| API Base URL | `https://api.deepseek.com` | DEEPSEEK_BASE_URL |
| 模型 | `deepseek-chat` | DEEPSEEK_MODEL |
| 温度 | 对话0.7 / 评分0.3 | 硬编码 |
| 聊天 max_tokens | 512 | LLM_CHAT_MAX_TOKENS |
| 评分 max_tokens | 2048 | LLM_SCORING_MAX_TOKENS |
| 聊天请求超时 | 30s | LLM_CHAT_TIMEOUT |
| 评分请求超时 | 120s | LLM_SCORING_TIMEOUT |
| 聊天最大重试 | 2 | 硬编码 |
| 评分最大重试 | 3 | 硬编码 |
| 并发限制 | 10 | LLM_CONCURRENT_LIMIT |
| 连接池大小 | 20 | LLM_CONNECTION_POOL_SIZE |
| Keepalive 连接 | 10 | LLM_CONNECTION_KEEPALIVE |

### 超时和 Token 分离设计 (v1.7-stable)

聊天和评分使用不同的超时和 token 限制，通过 `call_llm()` 的按调用参数实现：

| 调用类型 | timeout | max_tokens | max_retries | 说明 |
|----------|---------|------------|-------------|------|
| 聊天 (chat.py) | 30s | 512 | 2 | 患者回复 50-150 字，512 tokens 足够；失败快速检测 |
| 评分 (scoring.py) | 120s | 2048 | 3 | 评分 prompt 大、输出长，需要更大 token 和更长超时 |

每次请求还设置了独立的连接超时 `connect=15.0`，避免 TCP 握手阻塞过久。
重试延迟公式: `min(2^attempt, 4) + random(0, 0.5)` 秒，最多等待 4.5s 即进入下次重试。

## LLM 服务可靠性机制 (v1.6-concurrent 新增)

### 共享 HTTP 连接池
- 模块级 `httpx.AsyncClient` 单例，启动时初始化、关闭时清理
- 连接池配置：`max_connections=20, max_keepalive_connections=10`
- 每次 LLM 调用复用已建立的 TCP+TLS 连接，减少延迟 200-500ms
- 通过 `get_client()` / `close_client()` 管理生命周期

### 重试逻辑
- 内联实现，无需额外依赖
- 仅重试：HTTP 429、5xx、TimeoutException、ConnectError、RemoteProtocolError、ReadError
- 不重试：4xx 客户端错误（包括 401 认证失败）
- 所有重试耗尽后抛出 `RuntimeError` 含原始错误信息

### 并发限流
- `asyncio.Semaphore(10)`：最多 10 个并发 LLM 请求
- 超出限制的请求排队等待，防止触发 DeepSeek API 限流
- 40 人同时聊天时，最多 10 人实时获回复，其余排队

### JSON 容错解析 (`_safe_parse_json`)
- 清除 markdown 围栏（含 ` ```json ` 语言标识）
- 提取第一个 `{` 到最后一个 `}` 的 JSON 对象
- 标准 `json.loads()` 解析
- 失败时移除尾部逗号重试
- 最终降级：正则提取关键字段 (total_score / strengths / weaknesses / missed_content / suggestions / detail_scores)

---

## 虚拟患者 System Prompt 结构

位于 `backend/services/llm_service.py` → `build_patient_system_prompt()`

### Prompt层次

```
1. 身份设定（姓名、年龄、性别）
2. 主诉（含触发词提示："学生问你'哪里不舒服'时回答这个"）
3. 病史信息（6个章节，每个含触发关键词引导）
   - 现在的症状和发展（"哪里不舒服""什么时候开始的"）
   - 以前得过的病（"以前有什么病""慢性病""住过院吗"）
   - 平时用的药（"吃什么药""用什么药"）
   - 过敏情况（"对什么过敏""药物过敏吗"）
   - 家里人的病（"家里有人得病""遗传病"）
   - 生活习惯和家庭（"抽烟喝酒""做什么工作"）
4. 沟通风格
5. 重要规则（8条，按优先级排列）
   1. 问什么答什么（最重要）— 每次只回答一个话题，不混信息
   2. 只做患者 — 不扮演护士/老师/医生
   3. 信息边界 — 不编造
   4. 问题切换 — 学生换话题时完全切换，不联系前文
   5. 被动回答 — 不主动列病史
   6. 隐藏信息保护 — 明确提到才透露
   7. 回答长度 — 50-150字
   8. 护理评估 — 日常生活/情绪等如实回答
```

### 关键约束

- 患者绝对不能扮演老师或指导者角色
- 不能主动列出全部病史清单
- 不能提醒学生该问什么
- 学生问到才知道的信息才回答
- 不能编造病例中没有的信息
- **每个问题独立回答，不混入其他章节信息**
- **学生换新话题时完全切换，不锚定前文主题**

---

## 自动评分 System Prompt 结构

位于 `backend/services/llm_service.py` → `build_scoring_prompt_from_rubric()`

### 评分体系架构

```
LLM 按原始57分制逐项打分 (每项1-3)
        ↓
_validate_scoring_result() 校验 + 填默认值
        ↓
_convert_to_100_scale() 总分+维度分 ×100/57
        ↓
Score 入库 (100分制, score_scale=100)
```

### 评分维度（原始57分制 / 19个条目 / 显示100分制）

| 维度 | 条目数 | 单项分 | 原始满分 | 百分制满分 | 说明 |
|------|--------|--------|----------|-----------|------|
| 沟通技能 | 14项 | 1-3分/项 | 42分 | 74分 | 评估护患互动中的沟通技巧和人际交往能力 |
| 病史采集 | 5项 | 1-3分/项 | 15分 | 26分 | 评估全面收集病史信息的能力 |

### 评分标准版本化 (v1.14+)
- 评分标准存储在 `backend/rubrics/nursing_history_v1.json`
- 每项含 1/2/3 分锚点描述（如 "3: 主动礼貌问候，语气自然，使用恰当称呼，能建立初步信任"）
- 动态生成 Prompt，版本号记录在 Score.rubric_version（如 "nursing_history_v1@1.0"）
- `rubrics/__init__.py`: 加载 + 内存缓存，`load_rubric("nursing_history_v1")` 返回完整 rubric dict

### 证据化评分 (v1.14+)
- 每项必须提供 `evidence`（对话中的具体证据，30-80字）和 `reason`（评分理由，20-50字）
- 学生未提及则打1分，evidence 写"未涉及"
- `_validate_scoring_result()` 对 evidence 覆盖率 <50% 输出告警日志但不阻塞

### 评分容错 (v1.15)
- `strengths`, `weaknesses`, `missed_content` 缺失时填 `[]`
- `suggestions` 缺失时填 `""`
- 仅 `total_score` 和 `detail_scores` 缺失才拒绝评分

### 沟通技能 14项
1. 学生与病人打招呼并问候
2. 学生询问病人的姓名和个人信息
3. 学生自我介绍并说明角色
4. 学生展示尊重和关注
5. 学生识别病人的主要问题
6. 学生鼓励病人讲述症状（当前病史）
7. 学生使用开放性问题开始，并逐步转向封闭性问题
8. 学生专心聆听病人，避免打断
9. 学生通过语言技巧帮助病人表达
10. 学生通过非语言技巧促进沟通
11. 学生获取病史的时间顺序和症状详细情况
12. 学生询问病人的生活习惯和过敏史
13. 学生接受病人的感受和观点，而不做评判
14. 学生在访谈过程中保持合理的时间管理

### 病史采集 5项
1. 学生清晰地询问病人的过往病史
2. 学生询问病人的住院和手术史
3. 学生记录病人描述的症状，确保完整和准确
4. 学生询问病人的家族病史及遗传背景
5. 学生总结病史并确保病人没有遗漏重要信息

### 评分输出格式（LLM 原始输出，57分制）

```json
{
  "rubric_version": "nursing_history_v1@1.0",
  "total_score": 44,
  "detail_scores": {
    "沟通技能": {
      "score": 32,
      "max": 42,
      "items": [
        {"id": "comm_01", "name": "学生与病人打招呼并问候", "score": 3, "evidence": "...", "reason": "..."},
        ...
      ]
    },
    "病史采集": {
      "score": 12,
      "max": 15,
      "items": [...]
    }
  },
  "strengths": ["表现较好的具体行为描述1", ...],
  "weaknesses": ["存在不足的具体行为描述1", ...],
  "missed_content": ["学生漏问的关键内容1", ...],
  "suggestions": "个性化改进建议，200-350字，需结合对话实际内容"
}
```

> LLM 输出的 `total_score` 和维度 `score`/`max` 为原始57分制值，后端入库前自动换算为100分制。

---

## 通用问答 System Prompt

位于 `backend/routers/qa.py` → `NURSING_SYSTEM_PROMPT`

角色：护理教育导师
职责：解答护理专业问题、提供病史采集指导、解释护理操作规范
限制：仅回答护理相关问题、不提供处方建议、诚实说"不确定"

---

## 病例数据结构 (JSON)

位于 `backend/cases/*.json`

```json
{
  "name": "症状描述名称（不泄露诊断）",
  "description": "病例简介",
  "difficulty": 1,
  "time_limit": 20,
  "patient_info": { "name": "", "age": 0, "gender": "" },
  "chief_complaint": "主诉",
  "opening_line": "开场白（首次对话用）",
  "present_illness": "现病史",
  "past_history": "既往史",
  "medication_history": "用药史",
  "allergy_history": "过敏史",
  "family_history": "家族史",
  "social_history": "社会史",
  "communication_style": "患者沟通风格描述",
  "hidden_info": ["需学生主动询问才透露的信息"],
  "required_inquiries": ["评分时的必问内容清单"],
  "scoring_criteria": { /* 评分标准 */ }
}
```
- `difficulty`: 1=初级（结构化慢性病），2=中级（部分信息分散），3=高级（信息分散型，需追问与时间线梳理）
- `time_limit`: 训练时限（分钟），默认 20
```

### 当前病例（5个）

| # | 对外显示名称 | 真实诊断（仅后端） | 患者 | 难度 |
|---|------------|-------------------|------|------|
| 1 | 咳嗽咳痰伴呼吸困难 | COPD急性加重 | 王建国, 68岁男 | ★☆☆ 初级 |
| 2 | 足部皮肤破溃伴红肿疼痛 | 2型糖尿病足部感染 | 李秀兰, 58岁女 | ★★☆ 中级 |
| 3 | 右下腹痛 | 急性阑尾炎 | 李明, 27岁男 | ★★★ 高级 |
| 4 | 双膝关节疼痛伴晨僵 | 类风湿性关节炎 vs 骨关节炎 | 张桂英, 62岁女 | ★★☆ 中级 |
| 5 | 胸痛伴心悸 | 不稳定型心绞痛 vs ACS | 刘德明, 55岁男 | ★★★ 高级 |

### 添加新病例方法

**方式一（推荐）：教师后台在线管理** (v1.8 新增)
1. 使用教师账号登录 → 管理后台 → 病例管理
2. 点击「添加病例」→ 表单填写 → 保存
3. 或上传已有 `.json` 文件快速导入

**方式二：后端 JSON 文件**
1. 在 `backend/cases/` 目录下新建 `caseN.json`
2. 按照上述结构填写病例数据
3. 确保 `name` 为症状描述，不含诊断名
4. 设置 `hidden_info` 和 `required_inquiries`
5. 定义 `scoring_criteria`
6. 重启后端服务（自动导入）
