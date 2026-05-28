# 06 — 开发日志

## 版本历史

### v1.0 — 基础功能开发 (2026-05-20)

**完成内容：**

1. **后端骨架搭建**
   - FastAPI项目创建，配置管理 (config.py)
   - SQLite数据库连接 (database.py)
   - 5张ORM模型表定义 (models.py)：users, cases, training_records, messages, scores
   - Pydantic请求/响应模型 (schemas.py)

2. **认证系统**
   - JWT Token生成与验证 (auth.py)
   - bcrypt密码哈希
   - 登录/注册API (routers/auth.py)
   - `get_current_user`、`require_teacher`、`require_student` 权限中间件

3. **病例数据**
   - 病例1：咳嗽咳痰伴呼吸困难（COPD）
   - 病例2：足部皮肤破溃伴红肿疼痛（2型糖尿病足）
   - 含完整病史、沟通风格、隐藏信息、评分标准

4. **对话API**
   - DeepSeek API调用封装 (services/llm_service.py)
   - 虚拟患者System Prompt构建
   - 对话消息保存与LLM上下文管理 (routers/chat.py)

5. **训练流程**
   - 开始训练 (创建记录+开场问候)
   - 发送消息 (保存+LLM回复+保存)
   - 结束训练 (状态更新+触发评分)

6. **自动评分**
   - 评分System Prompt构建
   - 结构化JSON输出解析
   - 评分结果保存 (services/scoring.py)

7. **数据导出**
   - 全部记录CSV导出 / 单条记录TXT导出

8. **管理后台**
   - 用户管理 (列表+注册) / 统计概览

9. **前端骨架**
   - React + Vite项目搭建，6个页面 + 5个组件

---

### v1.1 — 界面改造 (2026-05-20)

**新增**: 侧边栏布局、首页概览(Home.jsx)、通用问答(QA.jsx)、训练统计(Stats.jsx)、笔记功能(notes表+CRUD API+前端面板)、全局CSS变量体系

---

### v1.2 — 病例去诊断化 (2026-05-20)

**修改**: 病例名称改为症状描述、CaseBrief API新增patient_summary字段、前端病例卡片不显示诊断信息

---

### v1.3 — 护理专业定向改造 (2026-05-20)

**核心改动**: 所有系统提示词和评分标准从"医学教育"改写为"护理教育"：

- **LLM提示词**: 开场语改为"护士你好"，新增护理评估规则
- **评分体系**: 四个维度重命名为护理导向——问诊系统性(30)、沟通技巧与人文关怀(25)、信息采集准确性(25)、护理专业素养(20)；新增功能与心理社会评估、人文关怀、健康宣教意识子维度
- **病例评分标准**: case1.json和case2.json的scoring_criteria完全改写
- **前端页面**: Home.jsx加入护理程序框架，CaseSelect.jsx改为四步护理评估框架
- **QA导师**: NURSING_SYSTEM_PROMPT扩展Gordon功能性健康型态等内容

---

### v1.4 — Dashboard 工作台 + 训练页极简化 (2026-05-20)

**问题反馈**: 界面布局混乱，训练页要素过多（侧栏+笔记面板+对话区挤在一起），不符合真实产品的操作体验

**完成内容：**

1. **首页重新设计 — DashboardHome.jsx**
   - 替换旧 Home.jsx 成为新首页
   - 布局从"Sidebar+内容区"改为"Header+三栏Grid"
   - 左栏(200px)：功能导航，当前页蓝色高亮
   - 中栏(自适应)：训练Hero卡片(Stethoscope图标+开始训练按钮+已选病例标签) + recharts柱状图统计
   - 右栏(340px)：病例库(点击选择)+ 训练反馈预览 + 快速提问(3个示例标签)
   - 未选病例时开始按钮禁用并提示
   - 反馈和图表使用 mock 数据，结构预留 API 接入

2. **训练页重新设计 — ChatTraining.jsx**
   - 从"Layout侧栏+对话区+笔记面板"极简化为"全屏对话框架"
   - 布局：顶部窄条(返回+患者信息+结束按钮) + 全宽对话区(max-width:800px居中) + 底部输入栏
   - 移除笔记面板（前端删除，后端API保留）
   - 移除Layout依赖，使用独立 training-shell 布局
   - 语音输入/朗读功能保留，内联实现

3. **新增组件**
   - `Header.jsx` — Dashboard顶部导航栏（Logo + 用户名 + 退出）
   - `TrainingDurationChart.jsx` — recharts柱状图，日/周/月period tabs切换，含mock数据

4. **笔记功能移除**
   - `ChatTraining.jsx` — 删除笔记面板和notes相关state/API调用
   - `RecordDetail.jsx` — 删除笔记展示区块
   - `api.js` — 删除4个notes相关API函数
   - 后端 `routers/notes.py` 和 `models.Note` 保留，可后续恢复或清理

5. **视觉系统升级**
   - 主色从 `#6366F1`(靛蓝) 改为 `#2563EB`(医疗蓝)
   - 背景从 `#F1F5F9` 改为 `#F5F6F8`
   - 卡片统一：白底 + 1px `#E5E7EB`边框 + 16px圆角 + 极轻阴影
   - 所有 emoji 替换为 lucide-react SVG 图标
   - 安装 `recharts` 和 `lucide-react` 依赖

6. **遗留文件**
   - 5个 v1.3 组件未使用：FeatureCard, CaseLibraryPanel, TrainingMainPanel, FeedbackPreviewCard, QuestionQuickAskCard — 功能已内联到 DashboardHome
   - 3个 v1.0 组件在新训练页不再使用：Avatar, ChatBubble, VoiceButton — 旧页面可能需要
   - 旧 Home.jsx 保留但不再路由引用

---

### v1.5 — 评分标准升级为19项 (2026-05-21)

**问题反馈**: 旧评分体系(4维度/100分制)不够细致，无法精准评估沟通技能和病史采集的每个具体行为。反馈内容需明确区分"表现较好"和"需要改善"。

**完成内容：**

1. **评分提示词完全重写** — `backend/services/llm_service.py`
   - 从4维度(问诊完整性/沟通技巧/信息准确性/专业素养, 满分100) 改为2大类别19项条目(满分57)
   - 沟通技能: 14项条目, 每条1-3分, 满分42分
   - 病史采集: 5项条目, 每条1-3分, 满分15分
   - 所有19项条目直接内嵌在System Prompt中(不再从case JSON读取)
   - 新增详细评分指导：每项必须根据对话实际内容独立评分，学生未提及即1分
   - strengths/weaknesses必须引用对话具体行为(禁止空泛套话)，suggestions需个性化(200-350字)

2. **病例评分标准更新** — `backend/cases/case1.json` & `case2.json`
   - `scoring_criteria` 从4维度格式替换为2类19项格式
   - 保留 `required_inquiries` 作为评分参考清单

3. **前端评分展示重写** — `frontend/src/components/ScoreCard.jsx`
   - 新增格式检测: `isNewFormat` 检查 detail_scores 是否包含 `{score, max, items}` 结构
   - 总分显示动态匹配正确满分(新格式57)
   - 新增逐项评分展示: 每项得分颜色编码(≥3绿色/≥2琥珀色/1红色)
   - 四个反馈区域: 表现较好(绿色✓) / 需要改善(琥珀色⚠) / 漏问内容(红色⚠) / 改进建议(蓝色💡)

4. **Dashboard首页Mock数据更新** — `frontend/src/pages/DashboardHome.jsx`
   - MOCK_FEEDBACK 更新为新格式(沟通技能33/42 + 病史采集12/15 = 45/57)
   - feedback-mini-grid 兼容新旧两种评分格式(运行时检测v类型)
   - 良好/待提高阈值从≥80调整为≥40

5. **数据库重置**
   - 删除旧 data.db, 重启后端自动创建新表结构

---

### v1.6-polish — 商业化打磨第一轮 (2026-05-21)

**目标**: 在 v1.5 主流程基础上，优先提升真实数据闭环、专业观感、安全配置和可维护性。

**完成内容：**

1. **Dashboard 反馈真实化**
   - `DashboardHome.jsx` 不再依赖 `MOCK_FEEDBACK`
   - 读取最新已完成训练记录，并通过记录详情接口获取完整评分
   - 无完成记录时展示空状态；存在进行中训练时提供继续训练入口

2. **训练统计真实化**
   - `TrainingDurationChart.jsx` 改为调用 `/api/stats/duration`
   - 支持近7天、近30天、全部三种范围
   - 新增加载态和无数据态

3. **评分口径统一**
   - `RecordDetail.jsx` 从硬编码 `/100分` 改为根据 `detail_scores.max` 动态计算
   - 当前新格式自动显示 `/57分`

4. **快速问答打通**
   - Dashboard 快速提问跳转 `/qa?q=...`
   - `QA.jsx` 读取 URL 参数并自动发送问题

5. **安全配置修正**
   - `backend/config.py` 移除明文 DeepSeek Key 默认值
   - `llm_service.py` 在未配置 `DEEPSEEK_API_KEY` 时返回明确错误
   - 启动指南改为推荐 PowerShell 环境变量配置

6. **视觉与质量打磨**
   - 主路径可见页面从临时 emoji 图标切换为 lucide-react SVG 图标
   - 补齐旧子页面样式变量、表单、病例卡、图表和空状态样式
   - 修复 ESLint 报错，使前端 `npm run lint` 通过

7. **新增交接文档**
   - 新增 `docs/08-polish-handoff.md`
   - 记录本轮改动、剩余问题、下一轮建议和压缩上下文摘要

---

## 当前项目状态

- **版本**: v1.10-stable
- **数据库**: SQLite WAL 模式 + QueuePool(5+15) 连接池 + 5个索引
- **LLM 服务**: 共享 httpx 连接池(20) + 分离超时(聊天30s/评分120s) + 分离token(512/2048) + 重试延迟封顶 + Semaphore(10) 并发限流 + JSON 容错解析
- **事务**: LLM 先调用再保存消息；评分成功后再标记完成 + 失败回滚
- **API路由**: 9个模块 (~29个端点)，含记录过滤/删除、用户编辑/删除、成绩排名、训练趋势
- **前端页面**: 9个（全在用）+ 组件 5个：Layout、ScoreCard、TrainingDurationChart、Toast、ProtectedRoute
- **前端特色**: 学生仪表盘中枢化（4卡片导航）+ 关联统计图表（ComposedChart双Y轴）+ Toast 通知 + 多维度过滤 + 病例难度分级（1-3星，含筛选）
- **内置病例**: 5个 (症状导向名称，不含诊断，含难度1-3级：初级1例/中级2例/高级2例)
- **LLM场景**: 3个 (虚拟患者对话 / 自动评分 / 护理问答)
- **评分体系**: 19项条目, 2类(沟通14项42分 + 病史5项15分 = 57分满分)
- **测试**: 后端 40 条 (pytest) + 前端 17 条 (Vitest) = 57 条，全部通过
- **部署**: lifespan 生命周期 + start.bat + 生产静态文件服务 + .env 配置
- **并发能力**: 验证可支撑 40 人同时在线训练
- **响应速度**: 聊天 1-2s，评分 ~13s

---

### v1.6-concurrent — 40人并发优化 (2026-05-21)

**目标**: 为支撑40名护理学生同时在线训练，对系统进行全栈并发性能优化。

**完成内容：**

#### Phase 1: 数据库层优化
- `backend/database.py` — 启用 SQLite WAL 模式 (`PRAGMA journal_mode=WAL`)，写操作不再阻塞读
- 设置 `PRAGMA synchronous=NORMAL` 降低同步开销，`busy_timeout=5000` 减少锁等待
- 显式配置 QueuePool：`pool_size=5, max_overflow=15, pool_pre_ping=True, pool_recycle=3600`
- `backend/models.py` — 新增3个复合索引：
  - `ix_msg_record_created` ON messages(record_id, created_at)
  - `ix_tr_user_status` ON training_records(user_id, status)
  - `ix_tr_status` ON training_records(status)
- WAL 文件验证通过 (`data.db-wal` + `data.db-shm` 已生成)

#### Phase 2: LLM 服务加固
- `backend/services/llm_service.py` — 模块级共享 `httpx.AsyncClient`，连接池配置 `max_connections=20, max_keepalive_connections=10`
- 新增内联重试逻辑：最多3次，指数退避 (1s/2s/4s + 随机抖动)，仅重试 429/5xx/连接错误
- 新增 `asyncio.Semaphore(10)` 并发限流，防止触发 DeepSeek API 限流
- 新增 `_safe_parse_json()` 容错解析：清除 markdown 围栏 → 提取 JSON 对象 → 标准解析 → 移除尾部逗号 → 正则降级提取

#### Phase 3: 事务安全修复
- `backend/routers/chat.py` — 调序：先调 LLM 获取回复，再原子保存学生消息+患者回复。LLM 失败时不持久化任何数据
- `backend/routers/training.py` — 调序：先评分，评分成功后再标记 completed。评分失败时 `db.rollback()` 保持 in_progress 状态，学生可重试

#### Phase 4: N+1 查询修复
- `backend/routers/training.py` `get_records()` — 使用 `joinedload()` 预加载 case/user/score 关联，1次查询替代 1+3N 次
- 新增 `limit` (默认50) 和 `offset` 分页参数
- `backend/routers/export.py` `export_records()` — 同样 joinedload 优化，消息计数直接从预加载列表 `len()` 获取

#### Phase 5: 服务器部署优化
- `backend/main.py` — `@app.on_event("startup")` 升级为 `lifespan` async context manager
- 启动时初始化共享 httpx 客户端，关闭时清理客户端 + 释放 SQLAlchemy 引擎
- 新增生产模式：检测 `frontend/dist/` 存在时自动挂载 StaticFiles，替代 Vite dev proxy
- 新增 `start.bat` — 4 worker 多核启动脚本

#### Phase 6: 前端韧性
- `frontend/src/api.js` — 响应拦截器新增自动重试：网络错误/超时/5xx 自动重试1次 (延迟1秒)。timeout 60s→120s
- `frontend/src/pages/ChatTraining.jsx` — 新增 `AbortController`：组件卸载/页面离开时取消进行中的 LLM 请求
- `frontend/vite.config.js` — 代理超时 120s，匹配评分长耗时场景
- `frontend/src/pages/History.jsx` — 新增 loading (Loader2 spinner) 和 error (重试按钮) 状态
- `frontend/src/styles/index.css` — 新增 `@keyframes spin` 动画

#### Phase 7: 配置管理
- 新增 `.env` 文件 (含 DeepSeek Key 和 LLM 参数) + `.env.example` (不含敏感数据)
- `backend/config.py` — 新增 `python-dotenv` 自动加载 + 5个新配置项
- `backend/requirements.txt` — 新增 `python-dotenv==1.0.1`

---

### v1.7-stable — Bug 修复 + 性能优化 (2026-05-22)

**问题反馈**: 试点中发现病例2（糖尿病足/李秀兰）训练时"答非所问"——患者回复与学生当前提问不匹配。同时聊天响应慢（5-30s），偶尔 LLM 调用超时失败。

**完成内容：**

#### Bug 修复 — chat.py 当前消息遗漏

- **根因**: `backend/routers/chat.py` — LLM 上下文构建时只从数据库读取历史消息，`req.content`（学生刚发的内容）未加入 LLM 上下文
- **症状**: LLM 收不到当前问题，总是对上一条消息做回应，形成"错位回答"。病例1 问题不明显（信息少），病例2 信息多所以暴露
- **修复**: 在调用 LLM 前追加 `llm_messages.append({"role": "user", "content": req.content})`（1行）
- **验证**: 全部 7 个测试问题通过相关性检查

#### Prompt 优化 — 强化回答正确性

- `backend/services/llm_service.py` → `build_patient_system_prompt()`
- 每个病史章节添加触发关键词引导：如"学生问'吃什么药'时回答这个"
- 新增"问题切换"规则：学生换话题时完全切换，不联系前文
- "问什么答什么"规则提升到第 1 位并加重强调
- 规则从 7 条扩展到 8 条

#### LLM 性能优化 — 聊天 1-2s 响应

- `backend/config.py` — 新增 4 个配置项：`LLM_CHAT_TIMEOUT=30`、`LLM_CHAT_MAX_TOKENS=512`、`LLM_SCORING_TIMEOUT=120`、`LLM_SCORING_MAX_TOKENS=2048`
- `backend/services/llm_service.py` — `call_llm()` 新增 `timeout`、`max_retries` 参数；重试延迟从无上限改为 `min(2^attempt, 4)+jitter` 封顶；每次请求设置独立 `httpx.Timeout(timeout, connect=15.0)`
- `backend/routers/chat.py` — 聊天用 `max_tokens=512, timeout=30s, max_retries=2`
- `backend/services/scoring.py` — 评分用 `max_tokens=2048, timeout=120s, max_retries=3`
- **优化效果**: 聊天响应 5-30s → 1.0-1.8s，评分响应 30-60s → ~13s
- `python-dotenv==1.2.2` 成功安装（清华镜像），`.env` 自动加载恢复正常

---

---

### v1.8-stable — 训练计时 + 教师病例管理 (2026-05-23)

**目标**: 完善教学场景必需功能——训练时间限制、教师端病例在线管理。

**完成内容：**

#### 训练倒计时器

- `frontend/src/pages/ChatTraining.jsx` — 计时从 count-up 改为 count-down
  - 从病例 `time_limit * 60` 秒开始倒计时（默认 20 分钟）
  - `timerActive` 布尔状态触发启动（避免 `[remaining]` 依赖导致的 interval 丢失 bug）
  - < 5 分钟：琥珀色背景警告 (`#fffbeb`)
  - < 2 分钟：红色背景警告 (`#fef2f2`, `#dc2626`)
  - 归零时自动调用 `executeEnd(true)` 结束训练（无确认弹窗）
  - 时间到后所有输入锁定，placeholder 显示"训练时间已结束"
  - 新增 `.time-up-banner` 提示"训练时间已结束，系统正在自动评分..."
- `handleEnd` 重构为 `executeEnd(isAuto)` + `handleEnd`：auto 模式静默失败不弹 alert
- `backend/cases/case1.json` & `case2.json` — 新增 `"time_limit": 20` 字段
- `backend/schemas.py` — `TrainingRecordDetail` 新增 `time_limit: int = 20`
- `backend/routers/training.py` — `get_record_detail` 从 case_data 提取并返回 time_limit

#### 训练时长展示

- `frontend/src/pages/History.jsx` — 新增"时长"列，计算 `(end_time - start_time) / 60000` 分钟，进行中显示"进行中"
- `frontend/src/pages/Admin.jsx` — 训练记录表新增"时长"列
- `frontend/src/styles/index.css` — 新增 `.training-timer` 样式（等宽数字、灰色背景、圆角边框）

#### 教师端病例管理 (v1.8 核心功能)

**后端 API** (`backend/routers/cases.py`)：
- `GET /api/cases/manage/list` — 教师查看所有病例，含训练次数统计
- `POST /api/cases` — 创建新病例（接收完整 case_data JSON）
- `PUT /api/cases/{id}` — 编辑病例
- `DELETE /api/cases/{id}` — 删除病例（有训练记录时拒绝，返回 400）
- 路由顺序调整：`/manage/list` 必须在 `/{case_id}` 之前

**后端 Schema** (`backend/schemas.py`)：
- `CaseCreateRequest` — `{ case_data: dict }`
- `CaseUpdateRequest` — `{ case_data: dict }`
- `CaseManageItem` — `id, name, description, patient_name, patient_age, patient_gender, chief_complaint, time_limit, created_at, training_count`

**前端 Admin** (`frontend/src/pages/Admin.jsx`)：
- 新增「病例管理」Tab（第4个Tab）
- 病例列表表格：名称、患者、主诉、时限、训练次数、操作（编辑/删除）
- 添加/编辑病例弹窗：
  - 基础信息：名称、时限、描述
  - 患者信息：姓名、年龄、性别
  - 临床信息：主诉、开场白、现病史、既往史、用药史、过敏史、家族史、社会史、沟通风格
  - 高级字段（可折叠）：隐藏信息（每行一条）、问诊要点（每行一条）、评分标准（JSON）
  - JSON 文件导入：上传按钮快速导入
  - `parseCaseData()` / `buildCaseData()` 双向转换表单 ↔ JSON
- 删除保护：有训练记录的病例禁用删除按钮
- CSS 新增：`.modal-overlay`, `.modal`, `.case-editor-form`, `fieldset`, `.btn-danger hover/disabled`, `.success-msg`, `.error-msg`

**前端 API** (`frontend/src/api.js`)：
- `getManageCases()`, `createCase(caseData)`, `updateCase(id, caseData)`, `deleteCase(id)`

#### Bug 修复 — 计时器停止 (v1.8-hotfix)
- **根因**: 倒计时 effect 依赖 `[remaining]`，每秒变化触发 cleanup 清除 interval，再因 `timerStartedRef=true` 直接 return 无法重启
- **修复**: 改用 `timerActive`（只从 false→true 一次）触发，interval 稳定运行

---

### v1.9-stable — 功能缺口补齐 + 仪表盘统一 + 测试套件 (2026-05-23)

**目标**: 逐一解决功能缺口，统一仪表盘体验，建立测试体系。

**完成内容：**

#### 搜索/过滤功能

- `backend/routers/training.py` `GET /records` — 新增5个查询参数：`student_name`（模糊搜索）、`case_id`、`status`、`date_from`、`date_to`
- 使用 `TrainingRecord.user.has(User.display_name.ilike(...))` 避免 JOIN 冲突
- `frontend/src/pages/Admin.jsx` — 新增过滤栏：学生姓名输入框、病例下拉、状态下拉、日期范围选择、清除过滤按钮

#### 用户管理（编辑/删除）

- `backend/routers/admin.py` — 新增 `PUT /admin/users/{id}`（编辑 display_name, student_id, role, password）+ `DELETE /admin/users/{id}`（不能删除自己）
- `frontend/src/pages/Admin.jsx` — 用户表格新增编辑按钮（弹出编辑模态框）和删除按钮（确认为弹窗）
- `frontend/src/api.js` — 新增 `updateUser(id, data)`, `deleteUser(id)`

#### Toast 通知系统

- `frontend/src/components/Toast.jsx` — 新建，基于 React Context 的全局通知系统
  - `ToastProvider` 包裹应用根组件
  - `useToast()` hook 返回 `{ toast, success, error, warning, info }`
  - 4 种类型（success/error/warning/info），各具独立颜色和图标
  - 最多同时 5 个，自动消失（4-6秒），可手动关闭
  - CSS 动画：滑入 + 进度条收缩
- 所有页面 `alert()` 替换为 `toast.error()` / `toast.success()` / `toast.warning()`

#### 学生成绩排名/排行榜

- `backend/routers/stats.py` — 新增 `GET /stats/ranking`（教师权限）
  - 按平均分降序排列所有学生
  - 返回 rank、avg_score、total_score、total_sessions、total_minutes
- `frontend/src/pages/Stats.jsx` — 新增"学生成绩排名"表格
  - 前三名显示金银铜奖牌（Medal 图标）
  - 排名列、学生、学号、训练次数、平均分（加粗蓝色）、总分、总时长

#### 训练记录删除

- `backend/routers/training.py` — 新增 `DELETE /records/{record_id}`（级联删除 messages、scores、notes）
  - 权限：教师可删除任意记录，学生仅可删除自己的
- `frontend/src/pages/Admin.jsx` — 训练记录表格操作列新增删除按钮（Trash2 图标）
- `frontend/src/pages/History.jsx` — 操作列新增删除按钮 + 确认弹窗 + Toast 反馈
- `frontend/src/api.js` — 新增 `deleteRecord(id)`

#### 统一仪表盘优化

- `frontend/src/pages/DashboardHome.jsx` — 重大重构
  - **改用 Layout 组件**（消除 DashboardHome 独立的 dash-nav 导航系统）
  - **角色分流**：
    - 教师仪表盘：全局概览统计卡片（学生总数/训练次数/完成率/平均分）+ 快捷操作按钮（管理后台/训练记录/训练统计/导出CSV）+ 训练时长趋势 + 最近训练动态列表
    - 学生仪表盘：训练工作台（病例选择 + 开始训练）+ 病例库 + 训练时长趋势 + 最新反馈 + 近期概览 + 快速提问
  - Admin 概览 tab 数据迁移至仪表盘，不再重复
  - CSS 新增 `.dashboard-grid`（双列响应式布局）
- `frontend/src/pages/Admin.jsx` — 移除「概览」Tab，默认进入「训练记录」
  - 4 Tab 精简为 3 Tab：训练记录 / 用户管理 / 病例管理

#### Stats 日期比较修复

- `backend/routers/stats.py` — `datetime.now(timezone.utc)` 改为 `datetime.now()`
  - 修复 offset-aware vs offset-naive 类型比较错误

#### 测试套件

- **后端测试** (pytest 9.0.3)
  - `backend/tests/conftest.py` — 测试基础设施：内存 SQLite + TestClient + teacher/student/test_case fixtures
  - `backend/tests/test_auth.py` — 12 条：登录成功/密码错误/用户不存在/注册/重复用户名/权限校验/Token
  - `backend/tests/test_training.py` — 16 条：开始训练/权限拦截/结束训练(含 LLM mock)/重复结束/记录过滤/删除
  - `backend/tests/test_admin.py` — 7 条：统计/用户列表/编辑/删除/权限
  - `backend/tests/test_cases.py` — 5 条：学生查看/教师管理CRUD/路由顺序
- **前端测试** (Vitest 4.1 + React Testing Library 16)
  - `frontend/src/__tests__/api.test.js` — 2 条：axios 实例创建、拦截器
  - `frontend/src/__tests__/Toast.test.jsx` — 6 条：渲染/显示/类型/关闭/自动消失/Provider 检测
  - `frontend/src/__tests__/Layout.test.jsx` — 9 条：内容/品牌/用户名/角色标签/学生导航/教师导航/登出/高亮
- **运行**: `cd backend && python -m pytest tests/ -v` (40 条) + `cd frontend && npx vitest run` (17 条) = 总计 57 条

---

### v1.10-stable — 学生仪表盘中枢化 + 统计图表关联化 (2026-05-24)

**目标**: 学生仪表盘从信息堆砌变为点击式功能中枢，统计图表从单一维度升级为关联组合图。

**完成内容：**

#### 学生仪表盘中枢化

- `frontend/src/pages/DashboardHome.jsx` — 学生视图重大重构
  - **移除**：内联 Hero 训练卡片、病例选择器、TrainingDurationChart、反馈侧边栏、快速提问输入框
  - **新增**：
    - 顶部状态条（`hub-status-bar`）：训练总次数、已完成、累计分钟、进行中/最新得分
    - 4 张可点击功能卡片（`hub-grid`+`hub-card`）：
      - **病史采集训练**（主卡片，蓝色强调）→ 跳转 `/cases`，含病例库数量和进行中训练标签
      - **训练时长统计** → 跳转 `/stats`，含累计分钟数
      - **训练反馈** → 跳转 `/history`，含最新得分
      - **快速提问** → 跳转 `/qa`，含 3 个示例标签（点击标签跳转 QA 并自动发送）
  - 教师仪表盘保持不变
- `frontend/src/pages/CaseSelect.jsx` — 新增「← 返回工作台」面包屑导航
- CSS 新增 `.hub-status-bar`、`.hub-grid`、`.hub-card`（含 hover 浮起动效）、`.hub-card-primary`、`.breadcrumb` 等样式
- API 调用优化：学生新增 `getDurationStats()` 调用获取累计分钟；移除不再使用的 `getRecordDetail`/`startTraining`

#### 统计图表关联化

- `backend/routers/stats.py` — 新增 `GET /api/stats/trends?period=week|month|all`
  - 返回每日汇总：`{ date, sessions, minutes, avg_score }`
  - 学生看自己的，教师看全部已完成记录
  - 同时返回汇总：`total_sessions`、`total_minutes`、`avg_score`
- `backend/schemas.py` — 新增 `TrendStats` 响应模型
- `frontend/src/pages/Stats.jsx` — 完全重写
  - 概览卡片更新为 4 项：总训练次数、总时长、平均得分、平均每次时长
  - **图表 1：训练投入 — 次数与时长**（ComposedChart，双 Y 轴）
    - 蓝色柱（次数，左轴）+ 橙色柱（时长分钟，右轴）
    - 揭示"练了多少次、每次多久"
  - **图表 2：训练效果 — 次数与得分**（ComposedChart，双 Y 轴）
    - 蓝色柱（次数，左轴）+ 绿色折线（平均得分，右轴）
    - 揭示"练得多是否分高"
  - 共享 period 切换器（近7天/近30天/全部）
  - 教师汇总表+排名表保持不变
- `frontend/src/components/TrainingDurationChart.jsx` — 升级
  - 从简单 BarChart（仅时长）升级为 ComposedChart（次数+时长双柱）
  - 数据源从 `getDurationStats` 切换为 `getTrends`
  - 汇总行新增"平均得分"指标
- `frontend/src/api.js` — 新增 `getTrends(period)` 导出
- CSS 新增 `.chart-tooltip` 样式

#### 病例难度分级

- `backend/cases/case1.json` — 新增 `"difficulty": 1`（初级：结构化慢性病）
- `backend/cases/case2.json` — 新增 `"difficulty": 2`（中级：部分信息分散）
- `backend/cases/case3.json` — **新建**，`"difficulty": 3`（高级：信息分散型外科急腹症，右下腹痛，需练追问与时间线）
- `backend/schemas.py` — `CaseBrief` 和 `CaseManageItem` 新增 `difficulty: int = 1`
- `backend/routers/cases.py` — `list_cases` 和 `_to_manage_item` 返回 `difficulty` 字段
- `frontend/src/pages/CaseSelect.jsx` — 难度筛选器（全部/初级/中级/高级） + 星级徽章（★☆☆ ~ ★★★）
- `frontend/src/pages/DashboardHome.jsx` — 病史采集训练卡片底部显示难度分布统计
- CSS 新增 `.difficulty-badge`、`.difficulty-chip`、`.difficulty-filter`、`.hub-difficulty-summary`

#### 扩展病例库 (v1.10)

- `backend/cases/case4.json` — **新建**，`"difficulty": 2`（中级：双膝关节疼痛伴晨僵，类风湿关节炎 vs 骨关节炎，风湿免疫/骨科方向）
- `backend/cases/case5.json` — **新建**，`"difficulty": 3`（高级：胸痛伴心悸，不稳定心绞痛 vs ACS，心血管方向，信息分散型+轻视症状型患者）
- 两个新病例覆盖尚未涉及的学科领域（风湿免疫、心血管），难度结构完整：初级1例 + 中级2例 + 高级2例 = 5例
- 病例新增导入时修复 `created_at` 为 NULL 导致教师端病例管理 500 错误的问题

#### Bug 修复

- **教师端病例管理 500 错误**：SQLite 直接导入的病例 `created_at` 为 NULL，Pydantic `CaseManageItem` 验证失败 → 修复为设置正确时间戳
- **训练记录病例筛选**：前端 Admin.jsx 病例下拉选项加载改为每次切换 Tab 时重新拉取 + 失败 toast 提示（之前静默吞错导致下拉为空）

---

### v1.11-stable — 第一梯队安全加固 (2026-05-25)

**目标**: 修复 4 项最紧急的安全与防滥用问题，为上线做准备。

**完成内容：**

#### 速率限制

- `backend/rate_limiter.py` — **新建**，内存滑动窗口限流器
  - 线程安全，惰性清理过期记录，支持 `reset_key()` 重置计数
  - 获取真实客户端 IP：支持 `X-Forwarded-For` / `X-Real-IP` 反向代理头
  - 后台每 10 分钟自动清理过期 key（在 lifespan 中通过 asyncio.create_task 调度）
- `backend/routers/auth.py` — 登录限流：同一 IP 5 分钟内最多 10 次失败（作为 Depends 运行在密码校验前）
  - 登录成功后自动调用 `reset_login_limit()` 清除失败计数，避免锁死合法用户
  - 注册限流：同一 IP 每分钟最多 5 次
- `backend/routers/chat.py` — 聊天限流：同一用户每分钟最多 6 条消息
- `backend/routers/qa.py` — 问答限流：同一用户每分钟最多 5 次

#### 密码强度统一

- `backend/schemas.py` — `RegisterRequest.password` 和 `BatchUserItem.password` 添加 `Field(min_length=6)`
- `backend/routers/admin.py` — 用户更新 + 批量导入密码检查下限从 4 改为 6
- `frontend/src/pages/Admin.jsx` — 注册表单 `minLength="6"` + placeholder "至少6位"，编辑用户密码同步更新

#### API Key 保护

- 确认 `.gitignore` 已包含 `.env`，`.env.example` 提供无敏感数据的模板
- 需用户手动去 DeepSeek 平台轮换已暴露的 Key

#### 审计日志系统

- `backend/logger.py` — **新建**，结构化 JSON 日志模块
  - 双输出：控制台 stdout + `logs/audit.log` 文件
  - 自定义 `_StructuredFormatter`：JSON 格式，自动附加 request_id/user_id/user_role/client_ip
  - 辅助函数：`log_info()`、`log_warning()`、`log_error()`
- `backend/main.py` — 新增 `request_id_and_audit_middleware`
  - 每个请求分配唯一 X-Request-ID（从请求头提取或自动生成）
  - 记录请求摘要：method + path + 状态码 + 耗时(ms) + client_ip
  - 自动从 JWT 解析 user_id/user_role 附加到日志
  - 响应头返回 X-Request-ID
- 敏感操作审计日志：
  - `backend/routers/admin.py` — 用户更新/删除/批量导入记录操作者信息
  - `backend/routers/cases.py` — 病例创建/编辑/删除记录操作者信息
  - `backend/routers/training.py` — 训练记录删除记录操作者信息
  - `backend/services/llm_service.py` — LLM 调用失败记录完整错误信息

---

### v1.12-stable — 第二梯队韧性修复 + 流式响应 + 时区Bug修复 (2026-05-25)

**目标**: 完成第二梯队全部可靠性与韧性修复，上线流式对话提升感知速度，修复自动评分误触发和时间对比崩溃等关键 Bug。

**完成内容：**

#### 流式对话 (SSE Streaming)

- `backend/services/llm_service.py` — 新增 `call_llm_stream()` 异步生成器
  - 使用 `client.stream()` + `aiter_lines()` 解析 SSE 数据
  - 逐 chunk yield 文本内容，首字延迟大幅降低
- `backend/routers/chat.py` — 新增 `POST /{record_id}/message/stream` 端点
  - 返回 `StreamingResponse(text/event-stream)`
  - 流式完成后原子保存学生消息+患者回复到数据库
  - 失败时通过 SSE 推送 error 事件
- `frontend/src/api.js` — 新增 `sendMessageStream()` 函数
  - 使用 `fetch` + `ReadableStream` + `TextDecoder` 消费 SSE 流
  - 支持 `onChunk` / `onDone` / `onError` 回调 + `AbortController`
- `frontend/src/pages/ChatTraining.jsx` — 发送逻辑改用流式
  - 消息气泡逐字追加显示，`streaming` 状态加闪烁光标动画
  - 加载指示器仅在无流式消息时显示
  - 朗读按钮仅在流式完成后出现
- `frontend/src/styles/index.css` — 新增 `.msg-bubble.streaming::after` 闪烁光标动画

#### 第二梯队：可靠性与韧性（全部 5 项完成）

1. **15 处静默吞错 → toast.error** — 所有 `.catch(() => {})` 替换为 `toast.error()` 用户可见提示
2. **LLM 失败恢复输入** — `handleSend` 错误路径自动恢复用户已输入文本，不再丢失
3. **beforeunload 离开守卫** — 训练进行中（remaining>0 且未评分）关闭/刷新浏览器弹出确认提示
4. **定时器防绕过** — 倒计时基于服务端 `start_time` 计算剩余时间（而非客户端计数），刷新页面不会重置
5. **Error Boundary 全局异常边界** — 新增 `ErrorBoundary` 组件包裹应用根，渲染异常不再白屏

#### 关键 Bug 修复

- **自动评分误触发**（最严重 Bug）:
  - 根因：SQLite 不保留 datetime 时区信息 → Pydantic 序列化 datetime 无 Z 后缀 → JavaScript `new Date()` 按本地时区(UTC+8)解析 → 8 小时偏移 → remaining 瞬间归零 → 触发自动结束评分
  - 修复：`backend/models.py` 新增 `UtcDateTime` TypeDecorator，所有 DateTime 列改为 `UtcDateTime`，在 bind/result 层透明处理时区
- **统计页"加载失败"**:
  - 根因：`stats.py` 中 `datetime.now()` 返回 offset-naive 时间，与 DB 中 UTC-aware 时间比较触发 Python TypeError
  - 修复：stats.py + training.py 日期过滤统一使用 `datetime.now(timezone.utc)` + `fromisoformat` 后检查并设置时区
- **LLM 连接断开 (RemoteProtocolError)**:
  - 修复：共享客户端 `keepalive_expiry=30` 避免过期连接复用 + 发生 `RemoteProtocolError` 时自动 `_reset_client()` 重建连接池

#### 系统提示词优化

- `build_patient_system_prompt()` 从 ~2200 字符精简到 ~1000 字符
- 减少 token 消耗和首字延迟

---

### v1.13-stable — 第三梯队运维与可观测性 (2026-05-26)

**目标**: 补齐上线运维必需的基础设施——健康检查、数据库备份、数据安全与导出优化。

**完成内容：**

1. **`/api/health` 健康检查端点** — `backend/main.py`
   - 新增 `GET /api/health`：验证数据库连接 (`SELECT 1`) + 返回服务版本
   - DB 异常时返回 503，方便反向代理/监控系统自动摘除故障节点

2. **数据库一键备份** — `backend/routers/admin.py`
   - 新增 `POST /api/admin/backup`（教师权限）
   - 解析 DATABASE_URL 获取 SQLite 文件路径
   - 带时间戳备份至 `backups/` 目录，自动保留最近 10 个
   - 审计日志记录备份操作

3. **批量导入密码脱敏** — `frontend/src/pages/Admin.jsx`
   - 预览表格密码列从明文改为 `****`（长度为原密码长度，上限 8 位）
   - 防止批量导入时屏幕投射/共享暴露学生密码

4. **训练记录分页元数据** — `backend/routers/training.py`
   - `GET /records` 响应头新增 `X-Total-Count` 和 `X-Has-More`
   - 基于同一过滤条件执行 count 查询，前端可据此显示"共 N 条"和翻页按钮

5. **CSV 流式导出** — `backend/routers/export.py`
   - `export_records()` 从全量 `io.StringIO` 改为流式 generator + `yield_per(100)`
   - 数据库逐批取行、逐行 yield CSV，服务器端不再持有全部 CSV 在内存中
   - 新增 BOM 字符 (`﻿`) 确保 Excel 正确识别 UTF-8 编码

---

### v1.14-stable — 评分体系升级 + 界面商业级重构 (2026-05-26)

**目标**: 评分从"给个分"升级为"可解释的证据链+教师可复核"，界面从"能用"升级为"统一设计系统+组件化+动画打磨"。

**完成内容：**

#### 评分标准版本化（Step 3）

- `backend/rubrics/__init__.py` — **新建**，评分标准加载与缓存模块
  - `load_rubric(version)` 从 JSON 文件加载评分标准，结果缓存
  - `get_rubric_versions()` 返回可用版本列表
  - `get_rubric_version_id()` 返回版本标识
- `backend/rubrics/nursing_history_v1.json` — **新建**，19项评分标准定义文件
  - 2 维度：沟通技能(14项, max 42) + 病史采集(5项, max 15)
  - 每项含 id、name、anchors(3分/2分/1分描述)、正面示例、反面示例
  - 版本号 "1.0", total_max: 57, scale: 3
- `backend/migrations/versions/d4e5f6g7h8i9_add_rubric_fields.py` — **新建**，scores 表新增 4 列
  - `rubric_version`(String 40), `model_name`(String 80), `prompt_version`(Integer), `score_scale`(Integer)
  - 旧数据回填: `rubric_version='legacy_100'`, `score_scale=100`
- `backend/models.py` — Score 模型新增 9 列（评分元数据 + 复核字段）
- `backend/services/llm_service.py` — 新增 `build_scoring_prompt_from_rubric()`
  - 从 rubric JSON 动态生成 Prompt，替代硬编码 19 项
  - 每项要求输出 `evidence`(30-80字对话证据) + `reason`(20-50字评分理由)
  - 输出模板含 `rubric_version` 版本追踪

#### 证据化评分（Step 4）

- `backend/services/scoring.py` — 评分逻辑升级
  - `evaluate_training()` 加载 rubric + 传入版本/model/prompt信息到 Score
  - `_validate_scoring_result()` 软校验 evidence 字段：缺失超 50% 告警日志但不拒绝
- `frontend/src/components/ScoreCard.jsx` — 完全重写
  - 每项评分可点击展开/关闭 evidence + reason（有证据时才可点击）
  - 低分项(score < 2)默认展开；无 evidence 的旧格式评分保持只读
  - 顶部显示评分标准版本标签（"旧版评分标准" / "评分标准: nursing_history_v1"）
  - 展开/折叠过渡动画 (max-height + opacity transition 0.3s)
  - 得分条填充动画 (transition: width 0.6s ease)
  - 模态框滑入动画 (@keyframes scoreSlideUp)

#### 教师复核（Step 5）

- `backend/migrations/versions/e5f6g7h8i9j0_add_score_review.py` — **新建**，scores 表新增 5 列
  - `review_status`(String 20), `reviewed_by`(FK→users), `reviewed_at`(DateTime), `review_detail_scores`(JSON), `review_comment`(Text)
- `backend/schemas.py` — 新增 `ScoreReviewRequest`, `ScoreReviewResponse`
- `backend/routers/training.py` — 新增复核 API
  - `GET /api/training/records/{record_id}/review` — 返回复核状态、复核人、原始与修订评分
  - `POST /api/training/records/{record_id}/review` — 教师提交复核（修改分项分数 + 备注）
- `frontend/src/api.js` — 新增 `getScoreReview()`, `submitScoreReview()`
- `frontend/src/pages/RecordDetail.jsx` — 教师复核前端
  - 评分摘要卡显示复核状态徽章：`Badge "AI初评"(蓝色)` / `Badge "教师已复核"(绿色)`
  - 教师端："复核评分"按钮 → 打开 `ReviewEditor` 模态框
  - ReviewEditor：逐项显示 AI 评分 + 证据/理由(可展开) + 1/2/3 分数按钮 + 复核备注文本框
  - 学生端：查看复核状态 + 复核人姓名 + 复核备注
  - `required_inquiries` 字段添加到记录详情 API（Schema + Router），供采集进度侧栏使用

#### 设计系统基础设施（Step 1）

- `frontend/src/styles/tokens.css` — **新建**，完整 CSS 变量体系
  - 完整色板：blue/teal/green/amber/red/gray 各 50-900
  - 语义 Token：--color-primary/success/warning/danger/info
  - 间距系统：4px 基础单位 (4-48px)
  - 字体层级、圆角、阴影、z-index、过渡、向后兼容别名
- `frontend/src/styles/index.css` — `@import './tokens.css'` 替代 `:root` 块
- `frontend/src/components/ui/Button.jsx` — **新建**，统一按钮组件
  - variant: primary/secondary/danger/outline/ghost
  - size: sm/md/lg，支持 icon、loading(spinner)、disabled
  - hover 态通过 onMouseEnter/onMouseLeave 处理
- `frontend/src/components/ui/Card.jsx` — **新建**，统一卡片（title/titleIcon/actions/children）
- `frontend/src/components/ui/Badge.jsx` — **新建**，徽章（success/info/warning/danger/neutral）
- `frontend/src/components/ui/ConfirmDialog.jsx` — **新建**，Context 驱动确认弹窗
  - `ConfirmProvider` 包裹根组件，`useConfirm()` 返回 `{ confirm }`
  - `confirm({ title, message, danger })` 返回 `Promise<boolean>`
  - 支持堆叠调用、danger 模式（红色警告图标）
- `frontend/src/components/ui/EmptyState.jsx` — **新建**，空状态占位
- `frontend/src/components/ui/LoadingState.jsx` — **新建**，加载状态(spinner + message)

#### ConfirmDialog 替换（Step 2）

- `frontend/src/App.jsx` — 包裹 `<ConfirmProvider>`
- 5 处 `window.confirm()` 替换为自定义 ConfirmDialog：
  - `ChatTraining.jsx`: 结束训练 + 离开训练
  - `History.jsx`: 删除记录
  - `Admin.jsx`: 删除记录 + 删除用户 + 删除病例（含 training_count 前置检查）

#### AppShell 统一布局（Step 6）

- `frontend/src/components/AppShell.jsx` — **新建**，统一布局组件
  - 与原 Layout 结构一致（sidebar + main-content），新增 variant 属性预留
- `frontend/src/components/Layout.jsx` — 精简为 `import AppShell from "./AppShell"; export default AppShell;`
  - 7 个页面无需修改导入（通过 Layout 透明重导出）
- `frontend/src/components/Header.jsx` — **已删除**（零引用死代码）
- `frontend/src/styles/index.css` — 清理 103 行孤儿 CSS
  - 删除：`.dash-header`, `.header-*`, `.dash-shell`, `.dash-body`, `.dash-nav`, `.dash-nav-label`, `.dash-nav-item`, `.dash-center`
  - 删除响应式中的 `.dash-body`, `.dash-nav`, `.dash-side` 引用

#### 页面级 UI 打磨（Step 7）

- `frontend/src/pages/Login.jsx` — 使用 Card/Button 组件 + 品牌 logo 渐变 + 阴影
- `frontend/src/pages/DashboardHome.jsx` — 状态用 Badge 组件，快捷操作用 Button 组件
- `frontend/src/pages/ChatTraining.jsx` — 新增「采集进度」侧栏
  - 客户端中文 bigram 关键词匹配 `required_inquiries`，不调 LLM，不泄露答案
  - 顶部工具栏显示进度按钮（计数+完成率小圆点），点击打开侧边面板
  - 侧栏：进度条 + 每项完成/未完成图标 + 截短的问题标签 + 底部提示
  - 实时更新（`useMemo` 基于学生消息计算）
  - 后端 `TrainingRecordDetail` 新增 `required_inquiries` 字段

### v1.16-stable — 商业级布局优化 (2026-05-27)

**目标**: 按照留言板文档的6个Phase，对学生端和教师端页面进行商业级布局优化，建立统一的设计语言和组件体系。

**完成内容：**

#### Phase 0: CSS 修复
- `frontend/src/main.jsx` — 添加 `import "./styles/index.css"`（根因修复：CSS全局样式完全丢失，所有页面显示浏览器默认样式）

#### Phase 2: UI 组件库扩充（8个新组件）
- `frontend/src/components/ui/Tabs.jsx` — **新建**，Tab 导航组件（icon + label + count badge）
- `frontend/src/components/ui/Table.jsx` — **新建**，配置化表格（columns数组 + rowKey + empty插槽 + hover + onRowClick）
- `frontend/src/components/ui/PageHeader.jsx` — **新建**，统一页面标题（title + subtitle + icon + actions + back导航）
- `frontend/src/components/ui/StatCard.jsx` — **新建**，统计卡片（icon 44×44 + value + label + 5色主题: blue/teal/green/amber/red + trend指示器）
- `frontend/src/components/ui/Modal.jsx` — **新建**，模态框（overlay click关闭 + ESC关闭 + body scroll lock + title/footer插槽 + maxWidth配置）
- `frontend/src/components/ui/FormField.jsx` — **新建**，表单字段封装（Input + Select + Textarea + focus/blur样式）
- `frontend/src/components/ui/Toolbar.jsx` — **新建**，工具栏布局（ToolbarLeft + ToolbarRight 插槽）
- `frontend/src/components/ui/Drawer.jsx` — **新建**，侧滑抽屉（left/right position + 滑入动画 + overlay）

#### Phase 3+4: 页面布局重构

**DashboardHome.jsx — 角色分流重构**
- 从单文件拆分为 `StudentDashboard` + `TeacherDashboard` 两个独立函数组件
- 教师仪表盘：PageHeader + 5 StatCard（学生总数/总训练/已完成/平均分/通过率）+ 训练趋势图 + 2列布局（最近动态 + 快捷操作/数据概览）
- 学生仪表盘：PageHeader + 状态栏 + 2列65/35布局（训练Hero + 推荐病例 + 最近记录）+ 侧面板（最新反馈 + 快速提问 + 周统计）

**Admin.jsx — 拆分为 1+4 组件**
- Admin.jsx 从 ~1150 行精简为 ~40 行（Tabs 容器 + 4 个 Tab 子组件）
- `frontend/src/components/teacher/RecordsTab.jsx` — **新建**，训练记录管理（多维过滤栏 + 表格含得分颜色编码 + CSV导出 + ConfirmDialog删除）
- `frontend/src/components/teacher/UsersTab.jsx` — **新建**，用户管理（注册表单 + 用户列表 + Modal编辑 + Modal批量导入含CSV预览和密码脱敏）
- `frontend/src/components/teacher/CasesTab.jsx` — **新建**，病例管理（病例列表 + Modal编辑器含4个fieldset + JSON导入 + 删除保护）
- `frontend/src/components/teacher/MonitorTab.jsx` — **新建**，LLM调用监控（StatCard统计卡片 + 每日趋势柱状图 + 用途分布表 + 日志表格含分页和过滤）

**页面级 PageHeader 统一**
- `CaseSelect.jsx` — 使用 PageHeader 替换旧 breadcrumb 导航
- `History.jsx` — 使用 PageHeader
- `QA.jsx` — 使用 PageHeader
- `Stats.jsx` — 使用 PageHeader
- `RecordDetail.jsx` — 使用 PageHeader（含 backTo="/history"）

#### Bug 修复
- **Admin 页面"页面出错了"**: lint 修复时误删 `caseOptions` state，但 JSX 仍引用 `caseOptions.map()` → 恢复 state 声明并添加 `getManageCases()` API 加载
- **Lint 错误清理**: Admin.jsx 移除未使用的 `useNavigate`/`navigate`；CaseSelect.jsx 移除未使用的 `ArrowLeft`；UsersTab.jsx/CasesTab.jsx 移除未使用的 `X` 导入

---

### v1.15 — 评分容错修复 + 100分制转换 (2026-05-27)

**评分容错修复 (`services/scoring.py`)**
- `_validate_scoring_result()` 对 LLM 可能遗漏的可选字段（strengths, weaknesses, missed_content, suggestions）填入默认值（[] / ""），不再因缺失而拒绝整个评分
- 仅 `total_score` 和 `detail_scores` 缺失时才触发 ValueError
- 修复了 record #22 因 LLM 返回缺失字段导致评分失败的问题

**57分制 → 100分制转换**
- 评分标准从 57 分制转换为 100 分制展示
- LLM 仍按原始 57 分制评分（保持评分质量），后端入库前自动换算
- 转换公式: `score_100 = round(raw_score / 57 * 100)`
- `rubrics/nursing_history_v1.json`: 新增 `raw_max: 57`, `raw_scale: 3`, `total_max: 100`, `scale: 100`
- `services/scoring.py`: 新增 `_convert_to_100_scale()` 函数，在 `_validate_scoring_result()` 之后、Score 入库之前调用
- `services/llm_service.py`: Prompt 使用 `raw_max` 告诉 LLM 输出 57 分制原始分数，系统自动换算
- 旧版（legacy_100）记录总分已是 100 分制，无需迁移；新版记录 #7(49→86), #8(44→77) 已迁移

**前端修复**
- `RecordDetail.jsx`: 旧记录（legacy）的 scoreMax 计算直接取 100，不再错误计算为 60
- `ScoreCard.jsx`: 旧版评分不再显示误导性类别条（30分制），改为"旧版评分标准，仅总分有效"提示
- 前端构建成功验证

---

## 当前项目状态

- **版本**: v1.16-stable
- **数据库**: SQLite WAL 模式 + QueuePool(5+15) 连接池 + 5个索引 + UtcDateTime 时区保护 + 一键备份(教师) + 评分版本字段 + 教师复核字段 + LLM 调用日志
- **安全**: 速率限制（4端点）+ 密码强度统一（min_length=6）+ .env 保护 + 审计日志 + 批量导入密码脱敏
- **评分体系**: 19项条目 2类(沟通14项 + 病史5项) + **100分制显示**(57分制打分×100/57换算) + 证据化(evidence+reason) + 版本化(rubric JSON) + 教师复核(review_status/detail_scores/comment) + 可选字段容错(strengths/weaknesses/missed_content/suggestions 缺失时填默认值)
- **LLM 服务**: 共享 httpx 连接池(20) + 流式 SSE 响应 + 分离超时(聊天30s/评分120s) + 分离token(512/2048) + 重试延迟封顶 + Semaphore(10) 并发限流 + JSON 容错解析 + RemoteProtocolError 自动连接池重置 + LLM 调用审计日志(cost/token/latency)
- **前端设计系统**: tokens.css(CSS变量体系) + 14个UI组件(Button/Card/Badge/ConfirmDialog/EmptyState/LoadingState/Tabs/Table/PageHeader/StatCard/Modal/FormField/Toolbar/Drawer) + AppShell统一布局 + Toast通知 + ErrorBoundary
- **API路由**: 9个模块 (~33个端点)，含 health 检查、记录过滤/删除、用户编辑/删除、批量导入、成绩排名、流式聊天、数据库备份、分页元数据、教师复核、LLM 调用日志查询
- **前端特色**: SSE 流式对话(逐字显示+闪烁光标) + 采集进度侧栏(关键词匹配) + 教师复核编辑器 + ConfirmDialog + beforeunload 守卫 + timer 防绕过 + 输入恢复 + AbortController + Axios 重试 + 商业级布局(PageHeader/StatCard/Tabs/Modal/Drawer)
- **测试**: 后端 40 条 (pytest) + 前端 17 条 (Vitest) = 57 条，全部通过
- **部署**: lifespan 生命周期 + start.bat + 生产静态文件服务 + .env 配置
- **并发能力**: 验证可支撑 40 人同时在线训练
- **响应速度**: 聊天流式首字 <1s，评分 ~13s
- **患者角色保护**: patient_guard.py — 角色泄露检测、诊断泄露检测、隐藏信息规则引擎、fallback 回复

## 待处理事项

### 高优先级
- [x] 端到端测试 ✓
- [x] 40人并发性能优化 ✓
- [x] 评分失败保护 ✓
- [x] 聊天回答正确性修复 ✓
- [x] LLM 响应速度优化 ✓
- [x] 训练倒计时 + 到时自动结束 ✓
- [x] 教师端病例在线管理 ✓
- [x] 搜索/过滤功能 ✓ (v1.9)
- [x] 用户管理（编辑/删除） ✓ (v1.9)
- [x] Toast 通知系统 ✓ (v1.9)
- [x] 学生成绩排名 ✓ (v1.9)
- [x] 训练记录删除 ✓ (v1.9)
- [x] 统一仪表盘 ✓ (v1.9)
- [x] 测试套件 ✓ (v1.9)
- [x] 学生仪表盘中枢化 ✓ (v1.10)
- [x] 统计图表关联化 ✓ (v1.10)
- [x] 病例难度分级 ✓ (v1.10)
- [x] 新增病例4(关节疼痛/中级) + 病例5(胸痛心悸/高级) ✓ (v1.10)
- [x] 速率限制（4端点） ✓ (v1.11)
- [x] 密码强度统一（min_length=6） ✓ (v1.11)
- [x] API Key 保护 ✓ (v1.11)
- [x] 审计日志系统 ✓ (v1.11)
- [x] 第二梯队：15处静默吞错 + LLM失败丢输入 + beforeunload守卫 + 定时器绕过 + Error Boundary ✓ (v1.12)
- [x] 第三梯队：/health端点 + 数据库备份 + 密码脱敏 + 列表分页元数据 + CSV流式导出 ✓ (v1.13)
- [x] 训练页采集进度侧栏（关键词匹配 required_inquiries，不调 LLM） ✓ (v1.14)
- [x] 商业级布局优化：8个新UI组件 + DashboardHome重构 + Admin拆分4Tab + PageHeader统一 ✓ (v1.16)
- [ ] Phase 5: 响应式优化（平板/手机适配）
- [ ] 第四梯队：断网检测 + 消息重试按钮 + 病例长度校验 + Token刷新
- [ ] 第五梯队：补齐导出/笔记/统计/问答/批量导入/LLM失败路径测试覆盖
- [ ] 云服务器部署 (AWS EC2 t2.micro 首年免费方案)

### 可扩展功能
- [ ] 学生成绩对比分析
- [ ] 导出Excel格式（含图表）

### 代码清理
- [ ] 删除7个遗留组件文件
- [ ] 删除旧 Home.jsx
- [ ] 评估是否删除后端 notes 模块
- [ ] 清理未使用的 CSS 类

### 生产环境改进
- [x] SECRET_KEY 环境变量配置 ✓
- [x] LLM API 调用重试机制 ✓
- [x] JSON 解析容错 ✓
- [x] 请求并发限流 ✓
- [x] 前端请求取消 ✓
- [x] python-dotenv 成功安装 ✓
- [x] 前后端测试套件 ✓ (v1.9)
- [x] 速率限制 ✓ (v1.11)
- [x] 密码强度规范 ✓ (v1.11)
- [x] 审计日志 ✓ (v1.11)
- [ ] 数据库迁移到 PostgreSQL (SQLite WAL 已足够40人)
- [ ] 前端构建产物部署到 Nginx
- [ ] Docker 容器化部署
