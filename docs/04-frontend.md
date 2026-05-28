# 04 — 前端设计

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

## 技术栈

- React 19 (函数组件 + Hooks)
- react-router-dom v7 (客户端路由)
- Vite 8 (构建工具 + 开发服务器，代理超时 120s)
- axios (HTTP客户端，120s 超时 + 自动重试)
- recharts (柱状图，仅 TrainingDurationChart 使用)
- lucide-react (统一图标库，全项目使用)
- 纯CSS (CSS变量 + 无第三方UI组件库)

## 路由设计（当前）

| 路径 | 页面 | 权限 | 布局 | 说明 |
|------|------|------|------|------|
| /login | Login | 公开 | 居中卡片 | 登录页 |
| /home | **DashboardHome** | 登录 | Sidebar (Layout) | 首页仪表盘（角色分流） |
| /cases | CaseSelect | 学生 | Sidebar | 病例选择（难度筛选+星级徽章） |
| /training/:recordId | **ChatTraining** | 学生 | 独立极简 (training-shell) | 训练对话 |
| /qa | QA | 登录 | Sidebar | 护理专业问答 |
| /stats | Stats | 登录 | Sidebar | 训练统计 + 排行榜（教师） |
| /history | History | 登录 | Sidebar | 训练记录列表 + 删除 |
| /record/:id | RecordDetail | 登录 | Sidebar | 记录详情+对话回放 |
| /admin | Admin | 教师 | Sidebar | 管理后台（记录/用户/病例） |
| * | → /login | - | - | 未匹配路由 |

## 组件树（当前在用）

```
App
├── ConfirmProvider                 ★ 全局确认弹窗 (Context)
├── ToastProvider                   ★ 全局通知系统 (Context)
├── ErrorBoundary                   ★ 全局异常边界
├── Login                           ★ (使用 Card/Button 组件)
├── DashboardHome                   ★ 首页仪表盘 (StudentDashboard/TeacherDashboard)
│   ├── PageHeader                  ★ 页面标题 (v1.16)
│   ├── StatCard ×5                 ★ 教师仪表盘统计卡片 (v1.16)
│   ├── TrainingDurationChart       ★ recharts ComposedChart（日/周/月切换）
│   └── Tabs                        ★ 角色分流 (v1.16)
├── ChatTraining                    ★ 训练页（独立布局 + 倒计时 + 语音 + 采集进度侧栏）
│   ├── ScoreCard                   ★ 评分弹窗（证据化 + 动画）
│   └── InquirySidebar              ★ 采集进度侧栏（关键词匹配，不调LLM）
├── CaseSelect                      ★ 病例选择（难度筛选 + 星级徽章 + PageHeader）
├── QA                              ★ 护理问答 (PageHeader)
├── Stats                           ★ 训练统计 + 学生排行榜 (PageHeader)
├── History                         ★ 训练记录（含时长/删除，PageHeader + ConfirmDialog）
├── RecordDetail                    ★ (教师复核UI: ReviewEditor + Badge + PageHeader)
│   ├── ScoreCard
│   └── ReviewEditor                ★ 教师复核编辑器（逐项修改分数 + 复核备注）
├── Admin                           ★ 管理后台（Tabs + 4个Tab组件，v1.16 拆分）
│   ├── Tabs                        ★ Tab 导航 (v1.16)
│   ├── RecordsTab                  ★ 训练记录管理 (v1.16)
│   ├── UsersTab                    ★ 用户管理 (v1.16)
│   ├── CasesTab                    ★ 病例管理 (v1.16)
│   └── MonitorTab                  ★ LLM 调用监控 (v1.16)
│
└── Layout / AppShell               ★ Layout 重导出 AppShell
    └── (Sidebar + MainContent)

UI 组件库 (14个):
第一批 v1.14 (6个):
├── ui/Button        ★ 统一按钮（variant/size/loading/icon）
├── ui/Card          ★ 统一卡片（title/titleIcon/actions）
├── ui/Badge         ★ 徽章（success/info/warning/danger/neutral）
├── ui/ConfirmDialog ★ 确认弹窗（Context驱动，Promise<boolean>）
├── ui/EmptyState    ★ 空状态占位
└── ui/LoadingState  ★ 加载状态（spinner + message）
第二批 v1.16 (8个):
├── ui/Tabs          ★ Tab 导航（icon + label + count badge）
├── ui/Table         ★ 配置化表格（columns + rowKey + empty + hover）
├── ui/PageHeader    ★ 统一页面标题（title + subtitle + icon + actions + back）
├── ui/StatCard      ★ 统计卡片（icon 44×44 + value + label + 5色主题 + trend）
├── ui/Modal         ★ 模态框（overlay关闭 + ESC关闭 + body锁滚动 + title/footer）
├── ui/FormField     ★ 表单字段封装（Input + Select + Textarea）
├── ui/Toolbar       ★ 工具栏布局（ToolbarLeft + ToolbarRight）
└── ui/Drawer        ★ 侧滑抽屉（left/right + 滑入动画 + overlay）
```

## 布局详解

### 1. Sidebar 布局（AppShell/Layout 组件 — v1.14 统一为 AppShell）

所有页面（DashboardHome、CaseSelect、QA、Stats、History、RecordDetail、Admin）均使用 AppShell 布局。Layout.jsx 保留作为重导出包装器，向后兼容。

```
┌────────────┬────────────────────────────────┐
│  Sidebar   │       Main Content            │
│  200px宽   │                               │
│  深色背景  │  页面标题                      │
│            │                               │
│  导航菜单  │  页面主体                      │
│            │                               │
│  用户信息  │                               │
└────────────┴────────────────────────────────┘
```

- 侧边栏固定定位，深灰(#111827)背景
- 主内容区左边距200px，浅灰(#f5f6f8)背景

### 2. Training 布局（训练页 — v1.14 新增采集进度侧栏）

```
┌──────────────────────────────────────────────────────────┐
│ [←返回] (头像) 患者姓名 · 病例名 [采集3/5] ⏱ [结束训练] │
├──────────────────────────────────────────────────────────┤
│                                              ┌─采集进度─┐│
│              患者：我叫王建国...              │████░░ 60% ││
│                                              │✓ 起病时间 ││
│                    学生：您哪里不舒服？       │✓ 疼痛部位 ││
│                                              │○ 既往用药 ││
│              患者：我这两天喘不上来气...     │○ 过敏史   ││
│                                              │○ 生活方式 ││
├──────────────────────────────────────────────────────────┤
│ [🎤语音] [_______________输入框__________________] [→发送]│
└──────────────────────────────────────────────────────────┘
```

- **全屏布局**：100vh，无侧栏无多余面板
- **顶部窄条**：56px，返回+患者信息+结束训练
- **对话区**：max-width 800px居中
- **输入栏**：语音按钮+输入框+发送按钮
- **消息**：学生蓝色靠右，患者白色(带边框)靠左，hover显示朗读按钮

## DashboardHome 关键交互 (v1.16 商业级布局重构)

DashboardHome 按角色分流为两个独立函数组件，使用 PageHeader + Layout：

### 教师仪表盘（TeacherDashboard）
1. **PageHeader**: title="教师工作台", subtitle 含日期和欢迎语
2. **5 个 StatCard**: 学生总数 / 总训练次数 / 已完成训练 / 平均得分 / 通过率，各具独立颜色主题和图标
3. **训练投入趋势图**: TrainingDurationChart ComposedChart（次数+时长双柱，日/周/月切换）
4. **2 列布局**: 左栏（最近训练动态列表，含学生名/病例/状态/得分/详情链接）+ 右栏（快捷操作按钮 + 数据概览）

### 学生仪表盘（StudentDashboard）
1. **PageHeader**: title="学生工作台", subtitle 含日期和欢迎语
2. **状态栏**: 训练总次数 / 已完成 / 累计分钟 / 进行中(可点击继续) / 最新得分
3. **2 列布局 (65/35)**:
   - **左栏**: 训练 Hero 卡片（开始训练按钮 + 已选病例标签）+ 推荐病例列表 + 最近训练记录
   - **右栏**: 最新反馈卡片 + 快速提问（3个示例标签→跳转QA）+ 周统计摘要
4. **难度分布**: 病例卡片以颜色区分难度级别（绿色初级/橙色中级/红色高级）

## ChatTraining 关键交互

1. **发送消息**: Enter键发送，支持语音输入（Web Speech API）
2. **语音朗读**: hover患者消息时显示朗读按钮（Web Speech Synthesis）
3. **倒计时器**: 从病例 time_limit 倒计时，<5分钟琥珀色，<2分钟红色，归零自动结束训练并评分
4. **采集进度侧栏** (v1.14 新增): 工具栏按钮显示已覆盖/总问询数，点击打开侧边面板；客户端中文 bigram 关键词匹配 `required_inquiries`，不调 LLM，不泄露病例答案；包含进度条和逐项完成/未完成状态
5. **结束训练**: 自定义 ConfirmDialog 确认后调用API结束并触发自动评分；倒计时归零自动触发
6. **返回首页**: 左上角箭头返回 DashboardHome（训练进行中有 beforeunload + ConfirmDialog 离开守卫）

## 设计系统（v1.14 tokens.css 升级）

设计 tokens 集中在 `styles/tokens.css`，从 `index.css` 通过 `@import` 引入：

- **完整色板**: blue/teal/green/amber/red/gray 各 50-900
- **语义 Token**: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- **间距系统**: 4px 基础单位 (4-48px, 8px步进)
- **字体层级**: text-xs(0.7rem) → text-3xl(1.5rem)
- **圆角**: radius-sm(6px), md(8px), lg(12px), xl(16px)
- **阴影**: shadow-sm/md/lg
- **z-index**: z-sidebar(100), z-modal(1000), z-toast(2000)
- **向后兼容别名**: `--primary`, `--text`, `--text-secondary`, `--text-light` 等旧变量名保留

### 14 个 UI 组件

**v1.14 第一批（6个）:**
| 组件 | 路径 | 用途 |
|------|------|------|
| Button | `ui/Button.jsx` | variant(5种)/size(3种)/icon/loading/disabled |
| Card | `ui/Card.jsx` | title/titleIcon/actions/children |
| Badge | `ui/Badge.jsx` | variant(5种): success/info/warning/danger/neutral |
| ConfirmDialog | `ui/ConfirmDialog.jsx` | Context驱动，`useConfirm().confirm()` 返回 Promise<boolean> |
| EmptyState | `ui/EmptyState.jsx` | icon/title/description/action |
| LoadingState | `ui/LoadingState.jsx` | spinner + message |

**v1.16 第二批（8个）:**
| 组件 | 路径 | 用途 |
|------|------|------|
| Tabs | `ui/Tabs.jsx` | Tab导航（icon + label + count badge），支持 activeTab/onChange |
| Table | `ui/Table.jsx` | 配置化表格（columns数组 + rowKey + empty插槽 + hover效果 + onRowClick） |
| PageHeader | `ui/PageHeader.jsx` | 统一页面标题（title + subtitle + icon + actions + back导航） |
| StatCard | `ui/StatCard.jsx` | 统计卡片（icon 44×44彩色 + value + label + 5色主题 + trend指示器）|
| Modal | `ui/Modal.jsx` | 模态框（overlay关闭 + ESC关闭 + body锁滚动 + title/footer插槽 + maxWidth）|
| FormField | `ui/FormField.jsx` | 表单字段封装（label + Input/Select/Textarea + focus/blur样式）|
| Toolbar | `ui/Toolbar.jsx` | 工具栏布局（ToolbarLeft + ToolbarRight 插槽）|
| Drawer | `ui/Drawer.jsx` | 侧滑抽屉（left/right position + 滑入动画 + overlay关闭）|

## 已清理的遗留文件

- v1.7 删除 9 个文件：`Avatar.jsx`, `ChatBubble.jsx`, `VoiceButton.jsx`, `TrainingMainPanel.jsx`, `FeatureCard.jsx`, `CaseLibraryPanel.jsx`, `FeedbackPreviewCard.jsx`, `QuestionQuickAskCard.jsx`, `Home.jsx`
- v1.14 删除 `Header.jsx`（零引用死代码），~103 行孤儿 CSS（`.dash-*`, `.header-*`）

## 数据接入说明

`DashboardHome.jsx` 已接入真实训练记录：

- 病例库：`GET /api/cases`（5个病例，含 difficulty 字段，用于难度分布统计：初级1/中级2/高级2）
- 状态栏：`GET /api/training/records` + `GET /api/stats/duration`
- 训练统计：`TrainingDurationChart.jsx` 调用 `GET /api/stats/trends`（v1.10 新增）
- 快速提问：跳转 `/qa?q=...`

仍保留的 mock/示例内容只有 Dashboard 快速提问的三个示例标签。

## CaseSelect 病例选择 (v1.10 难度分级)

- **难度筛选器**: 顶部横向 chip 按钮（全部 / 初级 / 中级 / 高级），点击筛选
- **星级徽章**: 每张病例卡右上角显示难度（★☆☆ 初级 / ★★☆ 中级 / ★★★ 高级），颜色编码
- **主诉预览**: 引用块显示患者主诉，蓝色左边框
- **面包屑**: 「← 返回工作台」返回 DashboardHome
- 数据来源：`GET /api/cases`（含 `difficulty` 字段）

## Admin 管理后台 (v1.16 重构)

Admin 从单一 1150 行文件重构为 Tabs 容器（~40行）+ 4 个独立 Tab 组件：

### 训练记录 Tab（RecordsTab.jsx，默认）
- 多维过滤栏：学生姓名（模糊搜索）、病例下拉、状态选择、日期范围（起/止）、清除过滤
- 表格：学生、学号、病例、状态(Badge)、开始时间、时长、得分(颜色编码: 85+/70+/60+)、操作（查看详情 + 删除）
- CSV 导出按钮 + 记录总数显示
- 删除使用 ConfirmDialog 确认弹窗

### 用户管理 Tab（UsersTab.jsx）
- 注册新用户表单（可折叠，含用户名/密码/角色/姓名/学号）
- 用户列表：用户名、姓名、角色(Badge)、学号、注册时间、操作（编辑 + 删除）
- 编辑弹窗使用 Modal 组件（姓名/学号/角色/新密码）
- 批量导入弹窗使用 Modal 组件：
  - 粘贴文本（每行一个用户，逗号分隔）或上传 CSV 文件
  - 预览表格含密码脱敏显示（***）
  - 下载 CSV 模板
  - 导入结果反馈（创建成功/跳过数量）
- 删除保护：不能删除自己

### 病例管理 Tab（CasesTab.jsx）
- 病例列表：名称、患者(姓名·年龄·性别)、主诉、时限(Badge)、训练次数、操作（编辑/删除）
- 添加/编辑弹窗使用 Modal 组件（maxWidth=800）：
  - 结构化表单含 4 个 fieldset：基础信息、患者信息、临床信息、高级字段(可折叠)
  - JSON 文件导入按钮
  - 表单验证（病例名称必填）
- 删除保护：有训练记录时禁用删除按钮

### LLM 调用监控 Tab（MonitorTab.jsx，v1.16 新增）
- 统计卡片：今日调用次数 + 今日费用 + 7天调用次数 + 7天费用（StatCard 组件）
- 每日趋势柱状图（近7天/近30天切换）
- 按用途分布表格（对话/评分/问答，含次数/占比/token/费用）
- 调用日志表格（时间/用途/模型/token/费用/延迟/状态），支持分页和用途/状态过滤

## 韧性特性 (v1.6-concurrent 新增)

### AbortController 请求取消
- `ChatTraining.jsx`：组件卸载或用户离开页面时自动取消进行中的 LLM 请求
- 快速连续发送消息时取消上一次未完成的请求
- 取消的请求不再弹错误提示

### Axios 自动重试
- `api.js` 响应拦截器：网络错误、超时 (ECONNABORTED)、ERR_NETWORK、5xx 自动重试 1 次
- 重试延迟 1 秒，不重试 4xx 客户端错误
- 4xx 错误（如 401）直接跳转登录页，不重试

### 超时配置
- axios 默认超时：120 秒（匹配 LLM 评分长耗时）
- Vite dev proxy 超时：120 秒
- 前端 build 后无代理超时问题

### 加载/错误状态
- `History.jsx`：加载中显示 spinner 动画，错误时显示错误信息和"重试"按钮
- CSS 新增 `@keyframes spin` 动画和 `.spin` 工具类

### 请求取消函数签名
- `sendMessage(recordId, content, signal)` — 接受 AbortController.signal
- `endTraining(recordId, signal)` — 同上

## Toast 通知系统 (v1.9 新增)

`components/Toast.jsx` — 基于 React Context 的全局通知：

- `ToastProvider` 包裹 App 根组件，`useToast()` hook 提供便捷方法
- 4 种类型：`toast.success(msg)` / `toast.error(msg)` / `toast.warning(msg)` / `toast.info(msg)`
- error 6秒消失，warning 5秒，其他 4秒，可手动点击 X 关闭
- 最多同时 5 个，超出的排队等待
- CSS 动画：滑入 + 进度条收缩

## 前端测试 (v1.9 新增)

- 框架: Vitest 4.1 + @testing-library/react 16 + jsdom
- 3 个测试文件，17 条测试用例
- 运行: `npx vitest run`
