# 01 — 系统架构

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Python FastAPI | 异步高性能Web框架，lifespan 生命周期 |
| 前端框架 | React 19 + Vite | SPA单页应用 |
| 前端路由 | react-router-dom v7 | 客户端路由 |
| HTTP客户端 | axios (前端) / httpx (后端) | 前端120s超时+自动重试；后端共享连接池 |
| 数据库 | SQLite WAL模式 + SQLAlchemy ORM | QueuePool连接池(5+15)，读写并发 |
| 认证 | JWT (python-jose) | 无状态Token认证 |
| 密码哈希 | bcrypt (passlib) | 安全密码存储 |
| LLM API | DeepSeek Chat API | 虚拟患者对话 + 自动评分 + 护理问答 |
| LLM 可靠性 | 分离超时(聊天30s/评分120s)+重试(2-3次)+限流(10并发)+JSON容错 | 防止API限流和瞬时故障 |
| 语音 | 浏览器 Web Speech API | 语音识别 + 语音合成 |
| 图表 | recharts (ComposedChart) | 关联训练统计（双Y轴：次数+时长、次数+得分） |
| 图标 | lucide-react | 统一 SVG 图标库 |
| 评分标准 | rubrics/ JSON 文件 + 版本缓存 | 19项条目动态生成 Prompt，evidence+reason 证据化，100分制显示 |
| 教师复核 | review API + 前端 ReviewEditor | 教师逐项修改分数 + 备注，复核徽章 |
| 患者保护 | patient_guard.py | 角色泄露/诊断泄露检测，隐藏信息规则引擎，fallback 回复 |
| 配置管理 | python-dotenv | .env 文件自动加载 |
| 速率限制 | 内存滑动窗口（rate_limiter.py） | 无需 Redis，线程安全 |
| 审计日志 | Python logging（logger.py） | JSON 格式，控制台+文件，请求ID追踪 |

## 项目结构（当前）

```
编程/
├── backend/                              # 后端服务
│   ├── main.py                           # FastAPI入口 + lifespan生命周期 + 种子数据
│   ├── config.py                          # 全局配置 (API Key, LLM参数, .env加载)
│   ├── database.py                        # SQLite WAL模式 + QueuePool连接池
│   ├── rate_limiter.py                    # 内存滑动窗口速率限制器
│   ├── logger.py                          # 结构化JSON审计日志
│   ├── models.py                          # SQLAlchemy ORM模型 (6张表 + 3个复合索引)
│   ├── schemas.py                         # Pydantic请求/响应模型
│   ├── auth.py                            # JWT认证 + 角色权限中间件
│   ├── routers/                           # API路由 (9个模块)
│   │   ├── auth.py                        # 登录 / 注册
│   │   ├── cases.py                       # 病例列表 / 详情 / 教师CRUD管理
│   │   ├── training.py                    # 训练开始 / 结束 / 记录
│   │   ├── chat.py                        # LLM对话 (核心)
│   │   ├── notes.py                       # 训练笔记 CRUD (后端保留，前端已移除)
│   │   ├── qa.py                          # 通用护理问答
│   │   ├── stats.py                       # 训练时长统计
│   │   ├── export.py                      # CSV/文本导出
│   │   └── admin.py                       # 教师管理 (用户/统计)
│   ├── services/                          # 业务逻辑层
│   │   ├── llm_service.py                 # DeepSeek API封装 + System Prompt构建 + rubric动态评分Prompt
│   │   ├── scoring.py                     # 自动评分逻辑 + evidence软校验 + 57→100分制转换
│   │   ├── patient_guard.py               # 患者角色边界保护 (角色泄露/诊断泄露检测)
│   │   └── llm_logging.py                 # LLM调用审计日志 (token/cost/latency 独立会话)
│   ├── rubrics/                           # 评分标准 (v1.14 新增)
│   │   ├── __init__.py                    # 版本加载 + 缓存
│   │   └── nursing_history_v1.json        # 19项评分标准（含锚点、示例）
│   ├── migrations/                        # Alembic 数据库迁移
│   │   ├── ..._add_rubric_fields.py       # 评分版本化字段
│   │   └── ..._add_score_review.py        # 教师复核字段
│   ├── cases/                             # 病例数据 (JSON)
│   │   ├── case1.json                     # 咳嗽咳痰伴呼吸困难 (难度1)
│   │   ├── case2.json                     # 足部皮肤破溃伴红肿疼痛 (难度2)
│   │   ├── case3.json                     # 右下腹痛 (难度3)
│   │   ├── case4.json                     # 双膝关节疼痛伴晨僵 (难度2)
│   │   └── case5.json                     # 胸痛伴心悸 (难度3)
│   ├── requirements.txt
│   └── tests/                             # 后端测试 (pytest)
│       ├── conftest.py                    # 测试夹具 (内存SQLite + TestClient)
│       ├── test_auth.py                   # 认证测试 (12条)
│       ├── test_training.py               # 训练流程测试 (16条)
│       ├── test_admin.py                  # 管理功能测试 (7条)
│       └── test_cases.py                  # 病例CRUD测试 (5条)
│
├── .env                                   # 环境变量配置 (含 DeepSeek Key)
├── .env.example                           # 环境变量模板 (无敏感数据)
├── start.bat                              # 生产启动脚本 (1 worker, SQLite单进程)
│
├── frontend/                              # 前端应用
│   ├── src/
│   │   ├── App.jsx                        # 路由配置 + 权限守卫
│   │   ├── main.jsx                       # React入口
│   │   ├── api.js                         # 后端API调用封装
│   │   ├── pages/                         # 页面组件 (9个在用，均使用 PageHeader)
│   │   │   ├── Login.jsx                  # 登录页
│   │   │   ├── DashboardHome.jsx          # ★ Dashboard工作台 (当前首页)
│   │   │   ├── ChatTraining.jsx           # ★ 训练对话页 (极简全屏)
│   │   │   ├── CaseSelect.jsx             # 病例选择页 (旧版，保留)
│   │   │   ├── QA.jsx                     # 通用问答 (AI护理导师)
│   │   │   ├── Stats.jsx                  # 训练统计
│   │   │   ├── History.jsx                # 历史记录列表
│   │   │   ├── RecordDetail.jsx           # 记录详情 + 对话回放
│   │   │   └── Admin.jsx                  # 教师管理后台
│   │   ├── components/                    # 通用组件
│   │   │   ├── AppShell.jsx               # 统一侧边栏布局 (v1.14 新增)
│   │   │   ├── Layout.jsx                 # → 重导出 AppShell（向后兼容）
│   │   │   ├── ErrorBoundary.jsx           # 全局异常边界 (v1.12)
│   │   │   ├── TrainingDurationChart.jsx  # recharts ComposedChart
│   │   │   ├── Toast.jsx                  # Toast 通知系统 (Context + Hook)
│   │   │   ├── ScoreCard.jsx              # 评分结果弹窗（证据化+动画）
│   │   │   ├── ui/                        # 设计系统组件库 (14个)
│   │   │   │   ├── Button.jsx             #   统一按钮 (5 variant / 3 size)
│   │   │   │   ├── Card.jsx               #   统一卡片
│   │   │   │   ├── Badge.jsx              #   徽章 (5 variant)
│   │   │   │   ├── ConfirmDialog.jsx      #   确认弹窗 (Context驱动)
│   │   │   │   ├── EmptyState.jsx         #   空状态占位
│   │   │   │   ├── LoadingState.jsx       #   加载状态
│   │   │   │   ├── Tabs.jsx               #   Tab 导航 (v1.16)
│   │   │   │   ├── Table.jsx              #   配置化表格 (v1.16)
│   │   │   │   ├── PageHeader.jsx         #   统一页面标题 (v1.16)
│   │   │   │   ├── StatCard.jsx           #   统计卡片 5色 (v1.16)
│   │   │   │   ├── Modal.jsx              #   模态框 ESC关闭 (v1.16)
│   │   │   │   ├── FormField.jsx          #   表单字段封装 (v1.16)
│   │   │   │   ├── Toolbar.jsx            #   工具栏布局 (v1.16)
│   │   │   │   └── Drawer.jsx             #   侧滑抽屉 (v1.16)
│   │   │   └── teacher/                   # 教师端 Tab 组件 (v1.16)
│   │   │       ├── RecordsTab.jsx         #   训练记录管理
│   │   │       ├── UsersTab.jsx           #   用户管理
│   │   │       ├── CasesTab.jsx           #   病例管理
│   │   │       └── MonitorTab.jsx         #   LLM 调用监控
│   │   ├── styles/
│   │   │   ├── tokens.css                 # 设计系统CSS变量 (v1.14 新增)
│   │   │   └── index.css                  # 全局样式
│   │   └── __tests__/                     # 前端测试 (Vitest)
│   │       ├── setup.js                   # 测试环境配置
│   │       ├── api.test.js                # API模块测试 (2条)
│   │       ├── Toast.test.jsx             # Toast通知测试 (6条)
│   │       └── Layout.test.jsx            # 布局组件测试 (9条)
│   ├── index.html
│   ├── vite.config.js                     # Vite配置 (API代理到localhost:8000)
│   └── package.json
│
└── docs/                                  # 项目文档
    ├── README.md
    ├── 01-architecture.md
    ├── 02-api-reference.md
    ├── 03-database.md
    ├── 04-frontend.md
    ├── 05-llm-design.md
    ├── 06-dev-log.md
    └── 07-startup-guide.md
```

## 两种布局系统

当前项目存在**两种布局**，用于不同场景：

| 布局 | 使用页面 | 结构 |
|------|---------|------|
| **Sidebar (AppShell)** | DashboardHome, CaseSelect, QA, Stats, History, RecordDetail, Admin | 深色侧边栏(200px) + 主内容区 |
| **Training** | ChatTraining | 独立极简全屏布局 + 采集进度侧栏 |

> v1.14 已将 Layout 统一为 AppShell（Layout.jsx 保留为重导出包装器），删除了无引用的 Header.jsx 和 ~103 行孤儿 CSS。

## 架构设计原则

1. **前后端分离**：React SPA通过HTTP API与FastAPI后端通信
2. **开发时代理**：Vite开发服务器将`/api`请求代理到后端8000端口
3. **JWT无状态认证**：登录颁发Token，前端存储到localStorage，每次请求携带
4. **角色权限控制**：学生/教师双角色，API层和前端路由层双重守卫
5. **数据隔离**：学生只能查看自己的训练记录，教师可查看全部
6. **LLM服务封装**：DeepSeek API调用统一通过`services/llm_service.py`，Prompt模板集中管理

## 数据流

```
用户浏览器 → React前端 → HTTP API → FastAPI后端 → SQLite数据库
                                    ↓
                            DeepSeek API (对话/评分/问答)
```

## 并发支持

- SQLite WAL 模式：写操作不阻塞读，支持 40 人同时在线训练
- QueuePool 连接池 (pool_size=5, max_overflow=15)：连接复用，避免频繁创建/销毁
- 共享 httpx.AsyncClient：TLS 连接复用，减少 DeepSeek API 延迟
- asyncio.Semaphore(10)：LLM 调用并发限流，防止触发 API 限流
- uvicorn --workers 1：SQLite 不支持多进程写入，单进程 + WAL 模式足够 40 人并发
- 事务顺序修正：LLM 调用失败时不持久化数据，支持安全重试
- 前端 AbortController：页面离开时取消进行中请求，释放服务器资源
- 分离超时策略：聊天 30s（512 tokens，2次重试），评分 120s（2048 tokens，3次重试）

## v1.16 新增特性 — 商业级布局优化

- **8 个新 UI 组件**: Tabs, Table, PageHeader, StatCard, Modal, FormField, Toolbar, Drawer
- **DashboardHome 角色分流重构**: StudentDashboard（PageHeader+状态栏+2列65/35+训练Hero+推荐病例+侧面板）/ TeacherDashboard（PageHeader+5 StatCard+趋势图+2列动态/操作）
- **Admin 拆分为 4 个 Tab 组件**: RecordsTab（多维过滤+CSV导出+删除）/ UsersTab（注册+编辑Modal+批量导入Modal）/ CasesTab（CRUD Modal+JSON导入+删除保护）/ MonitorTab（LLM统计卡片+趋势图+日志表格+分页）
- **所有页面统一使用 PageHeader**: CaseSelect, History, QA, Stats, RecordDetail
- **Phase 0 CSS 修复**: main.jsx 添加 `import "./styles/index.css"` 解决全局样式丢失

## v1.15 新增特性

- **57→100分制转换**: LLM 仍按57分制打分，后端 `_convert_to_100_scale()` 入库前自动换算为百分制
- **评分容错**: LLM 遗漏 strengths/weaknesses/missed_content/suggestions 时填默认值，不拒绝整个评分

## v1.14 新增特性

- **评分标准版本化**: rubrics/ JSON 文件定义19项评分标准（含锚点/示例），动态生成 Prompt，版本追踪
- **证据化评分**: 每项评分附带 evidence（对话证据）+ reason（评分理由），ScoreCard 可点击展开
- **教师复核**: ReviewEditor 模态框逐项修改分数 + 复核备注，复核徽章（AI初评/教师已复核）
- **设计系统**: tokens.css（CSS变量体系）+ 6个UI组件（Button/Card/Badge/ConfirmDialog/EmptyState/LoadingState）
- **ConfirmDialog**: Context驱动确认弹窗替代5处原生 confirm()，支持 danger 模式
- **AppShell 统一布局**: 删除 Header.jsx，清理 103 行孤儿 CSS
- **采集进度侧栏**: 中文 bigram 关键词匹配 required_inquiries，不调 LLM，不泄露答案
- **动画打磨**: ScoreCard 展开/折叠过渡、得分条填充动画、模态框滑入

## v1.10 新增特性

- **学生仪表盘中枢化**: 4张点击式功能卡片（病史采集训练/训练时长统计/训练反馈/快速提问），点击导航
- **统计图表关联化**: ComposedChart 双Y轴（次数+时长、次数+得分），揭示训练投入与效果
- **病例难度分级**: 病例1-3级难度（★☆☆ / ★★☆ / ★★★），前端筛选器 + 星级徽章 + 难度分布统计
- **病例3**: 右下腹痛（信息分散型外科急腹症，高级难度）

## v1.8 新增特性

- **训练倒计时**: 病例配置 time_limit，训练页从时限倒计时，<5min 琥珀警告、<2min 红色警告，归零自动结束评分
- **教师病例管理**: Admin 新增「病例管理」Tab，支持在线 CRUD + JSON 文件导入
- **训练时长统计**: History 和 Admin 记录表显示训练时长（分钟），Dashboard 图表展示日汇总
