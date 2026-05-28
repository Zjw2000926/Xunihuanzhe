# 虚拟患者训练系统 — 项目文档

基于大语言模型的护理学生病史采集训练平台。

## 文档目录

| 文档 | 说明 |
|------|------|
| [01-系统架构](01-architecture.md) | 技术栈、项目结构、架构设计 |
| [02-API接口文档](02-api-reference.md) | 完整API端点、请求/响应格式 |
| [03-数据库设计](03-database.md) | 表结构、字段说明、关系映射 |
| [04-前端设计](04-frontend.md) | 页面组件、路由设计、两种布局系统 |
| [05-LLM与评分设计](05-llm-design.md) | 虚拟患者Prompt、评分Prompt、病例结构 |
| [06-开发日志](06-dev-log.md) | 开发进度、修改记录、当前状态 |
| [07-启动指南](07-startup-guide.md) | 环境配置、启动步骤、账号信息 |
| [08-商业化打磨交接记录](08-polish-handoff.md) | 本轮完善重点、剩余问题、下次继续开发摘要 |

## 当前版本

- **版本**: v1.16-stable
- **最后更新**: 2026-05-27
- **状态**: 商业级布局优化完成。学生端/教师端页面全面使用 PageHeader + StatCard + Tabs + Modal 等新UI组件，DashboardHome 角色分流重构，Admin 拆分为4个独立Tab组件。前端已有14个UI组件。剩余 Phase 5 响应式优化。

## 快速了解

1. 先看 [06-开发日志](06-dev-log.md) 了解**当前进度**（含 v1.16 布局优化 + v1.15 百分制 + v1.14 评分升级）
2. 再看 [01-系统架构](01-architecture.md) 了解整体设计
3. 查看 [04-前端设计](04-frontend.md) 了解**前端组件、设计系统、布局**
4. 查看 [07-启动指南](07-startup-guide.md) 了解如何运行

## 核心功能

- 学生/教师登录后进入角色专属仪表盘
- **学生仪表盘**：PageHeader + 状态栏 + 2列布局(65/35) + 训练Hero + 推荐病例 + 最近记录 + 侧面板(最新反馈/快速提问/周统计)
- **教师仪表盘**：PageHeader + 5 StatCard 统计卡片 + 训练趋势图 + 2列布局(最近动态 + 快捷操作/数据概览)
- 训练时与 LLM 驱动的虚拟患者进行对话，模拟真实病史采集
- **采集进度侧栏**：客户端中文关键词匹配，追踪关键问询覆盖，不调 LLM 不泄露答案
- 训练页含倒计时器（20分钟限制，<5分钟警告，到时自动结束评分 + ConfirmDialog 确认对话框）
- 结束训练后系统自动评分（沟通技能14项 + 病史采集5项 = 原始57分制 → 显示100分制）
- **证据化评分**：每项附带对话证据 + 评分理由，可点击展开查看
- **教师复核**：教师可逐项修改 AI 评分 + 添加备注，复核徽章区分"AI初评"/"教师已复核"
- **评分版本化**：评分标准独立 JSON 文件，版本追踪（rubric_version + model_name + prompt_version）
- **统计图表**：关联 ComposedChart（次数+时长、次数+得分），双Y轴对比
- **病例难度分级**：5个病例覆盖1-3级难度（初级1例/中级2例/高级2例），前端星级徽章+筛选器
- 教师端管理后台：4个Tab（训练记录/用户管理/病例管理/LLM调用监控），每个Tab含多维过滤、CSV导出、批量操作
- **设计系统**：tokens.css（CSS变量体系）+ 14个UI组件（Button/Card/Badge/ConfirmDialog/EmptyState/LoadingState/Tabs/Table/PageHeader/StatCard/Modal/FormField/Toolbar/Drawer）
- Toast 通知系统（成功/错误/警告/信息四种类型，自动消失）
- **流式对话**：SSE 逐字显示 + 闪烁光标动画，首字延迟 <1s
- **韧性保护**：Error Boundary 全局异常边界 + beforeunload 离开守卫 + 输入恢复 + 定时器防绕过
- **安全防护**：速率限制（登录/注册/聊天/问答）、密码强度统一（最低6位）、审计日志（JSON格式，控制台+文件，请求ID追踪）
- 前后端测试套件（57条测试，覆盖认证/训练/CRUD/组件）

---

## 当前开发状态总结

### 系统概览

虚拟患者训练系统（Virtual Patient Training System）是一个基于大语言模型的护理学生病史采集训练平台。学生通过与 DeepSeek Chat API 驱动的虚拟患者进行自然语言对话，模拟真实临床病史采集过程。系统自动对学生的沟通技能（14项）和病史采集（5项）进行 19 项细粒度评分（100分制），并提供证据化评分和教师复核机制。

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Python FastAPI (异步) |
| 数据库 | SQLite WAL 模式 + SQLAlchemy ORM + QueuePool(5+15) |
| 前端框架 | React 19 + Vite 8 (SPA) |
| 前端路由 | react-router-dom v7 |
| 认证 | JWT (python-jose) + bcrypt 密码哈希 |
| LLM API | DeepSeek Chat API (对话/评分/问答) |
| 图表 | recharts (ComposedChart) |
| 图标 | lucide-react |

### 已完成功能 (v1.0 → v1.16)

**核心业务**:
- 5个病例覆盖5个学科方向（呼吸/内分泌/消化/风湿免疫/心血管），1-3级难度（初级1/中级2/高级2）
- 虚拟患者对话（SSE流式，首字<1s）+ 自动评分（19项，100分制）+ 护理问答
- 训练倒计时（20分钟限制，<5分钟警告，到时自动结束）+ 采集进度侧栏（客户端关键词匹配）
- 证据化评分（evidence + reason 可展开）+ 教师复核（逐项修改 + 备注 + 复核徽章）
- 评分标准版本化（rubrics/nursing_history_v1.json）+ 评分容错

**前端设计系统（14个UI组件）**:
- v1.14 第一批（6个）: Button, Card, Badge, ConfirmDialog, EmptyState, LoadingState
- v1.16 第二批（8个）: Tabs, Table, PageHeader, StatCard, Modal, FormField, Toolbar, Drawer
- tokens.css 完整 CSS 变量体系（色板/间距/字体/圆角/阴影/z-index）

**页面状态**:
- 9个路由页面全部使用新设计系统组件
- DashboardHome: 完整的 StudentDashboard / TeacherDashboard 角色分流
- Admin: 拆分为 4 个独立 Tab 组件（RecordsTab / UsersTab / CasesTab / MonitorTab）
- ChatTraining: 独立极简全屏布局 + SSE 流式对话 + 采集进度侧栏
- 所有学生端页面已使用 PageHeader 统一标题栏

**基础设施**:
- JWT 认证 + 角色权限（student/teacher）
- 速率限制（4端点）+ 密码强度统一（≥6位）+ .env API Key 保护
- 审计日志（JSON格式，控制台+文件，请求ID追踪）+ LLM 调用审计日志
- /health 健康检查 + 数据库备份（教师）+ CSV 流式导出
- 韧性: Error Boundary + beforeunload + AbortController + Axios 重试 + UtcDateTime 时区保护

**测试**: 57 条（后端 pytest 40 条 + 前端 Vitest 17 条），全部通过

**并发**: 验证可支撑 40 人同时在线训练

### 当前版本架构快照

```
frontend/src/
├── App.jsx                              # 路由配置 + 权限守卫 + lazy loading
├── main.jsx                             # React 入口 (含 styles/index.css 导入)
├── api.js                               # 后端 API 封装
├── pages/
│   ├── Login.jsx                        # 登录页 (Card/Button 组件)
│   ├── DashboardHome.jsx                # 仪表盘 (StudentDashboard/TeacherDashboard)
│   ├── ChatTraining.jsx                 # 训练对话 (SSE 流式 + 采集进度侧栏)
│   ├── CaseSelect.jsx                   # 病例选择 (难度筛选 + PageHeader)
│   ├── QA.jsx                           # 护理问答 (PageHeader)
│   ├── Stats.jsx                        # 训练统计 + 排行榜 (PageHeader)
│   ├── History.jsx                      # 历史记录 (PageHeader)
│   ├── RecordDetail.jsx                 # 记录详情 + 教师复核 (PageHeader)
│   └── Admin.jsx                        # 管理后台 (Tabs + 4个Tab组件)
├── components/
│   ├── AppShell.jsx                     # 统一侧边栏布局
│   ├── Layout.jsx                       # → 重导出 AppShell
│   ├── Toast.jsx                        # Toast 通知系统
│   ├── ScoreCard.jsx                    # 评分结果弹窗（证据化 + 动画）
│   ├── TrainingDurationChart.jsx        # recharts ComposedChart
│   ├── ErrorBoundary.jsx                # 全局异常边界
│   ├── ui/                              # 设计系统组件库 (14个)
│   │   ├── Button.jsx                   # 统一按钮 (5 variant / 3 size)
│   │   ├── Card.jsx                     # 卡片
│   │   ├── Badge.jsx                    # 徽章 (5 variant)
│   │   ├── ConfirmDialog.jsx            # 确认弹窗 (Context)
│   │   ├── EmptyState.jsx               # 空状态
│   │   ├── LoadingState.jsx             # 加载状态
│   │   ├── Tabs.jsx                     # Tab 导航 (v1.16)
│   │   ├── Table.jsx                    # 配置化表格 (v1.16)
│   │   ├── PageHeader.jsx               # 统一页面标题 (v1.16)
│   │   ├── StatCard.jsx                 # 统计卡片 (v1.16)
│   │   ├── Modal.jsx                    # 模态框 (v1.16)
│   │   ├── FormField.jsx                # 表单字段 (v1.16)
│   │   ├── Toolbar.jsx                  # 工具栏 (v1.16)
│   │   └── Drawer.jsx                   # 侧滑抽屉 (v1.16)
│   └── teacher/                         # 教师端 Tab 组件 (v1.16)
│       ├── RecordsTab.jsx               # 训练记录管理
│       ├── UsersTab.jsx                 # 用户管理
│       ├── CasesTab.jsx                 # 病例管理
│       └── MonitorTab.jsx               # LLM 调用监控
└── styles/
    ├── tokens.css                        # CSS 变量体系
    └── index.css                         # 全局样式
```

### 未完成事项

| 优先级 | 事项 | 预估工作量 |
|--------|------|-----------|
| Phase 5 | 响应式优化（平板/手机适配） | 2-3h |
| 第四梯队 | 断网检测 + 消息重试 + 病例长度校验 + Token刷新 | 1-2h |
| 第五梯队 | 补齐导出/统计/问答/批量导入/LLM失败路径测试覆盖 (~30条) | 2-3h |
| 部署 | 云服务器部署 / Docker 容器化 | 4-6h |
| 清理 | 删除遗留未使用文件、清理未使用 CSS | 1h |

### 快速启动

```bash
# 后端 (端口 8000)
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# 前端 (端口 3000/3001)
cd frontend
npm install
npm run dev
```

默认账号: 教师 admin/admin123 | 学生 student1/123456 ~ student5/123456

### 关键约定

- 文件名/变量名使用英文，用户可见文本使用中文
- 病例名称使用症状描述（不泄露医学诊断）
- 所有 API 路径以 `/api/` 为前缀
- 前端通过 Vite proxy 转发 `/api` 请求到后端 8000 端口
- 后端 `.env` 存储敏感配置（DEEPSEEK_API_KEY 等），`.env.example` 为模板
