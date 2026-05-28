# AI界面商业级优化留言板

> 目标：将本系统的学生端和教师端界面彻底完善到商业级水平。  
> 面向后续接手的 AI 或开发者。请不要只做“换颜色、加阴影”这种表层美化，而要按产品设计系统、信息架构、页面工作流、响应式验收和浏览器截图 QA 的方式推进。

## 一、当前界面状态判断

项目当前前端已经具备主要页面，但还处在“可演示 MVP + 第一轮打磨”阶段。页面能用，但还没有形成完整商业产品的界面系统。

当前主要页面：

- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/DashboardHome.jsx`
- `frontend/src/pages/CaseSelect.jsx`
- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/History.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/pages/QA.jsx`
- `frontend/src/pages/Stats.jsx`
- `frontend/src/pages/Admin.jsx`

当前主要组件：

- `frontend/src/components/Header.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/TrainingDurationChart.jsx`
- `frontend/src/components/ScoreCard.jsx`

当前主要样式文件：

- `frontend/src/styles/index.css`

当前界面问题：

1. 首页 Dashboard、子页面 Sidebar、训练页独立布局三套视觉体系并存，产品体验不统一。
2. 样式主要集中在一个大 CSS 文件中，缺少可复用的设计系统和组件层。
3. 学生端和教师端的信息架构还不够明确，教师端像功能堆叠，不像教学管理工作台。
4. 页面状态不完整，例如加载、空数据、失败、评分中、评分失败、无权限等状态不够商业化。
5. 交互仍偏原型，很多地方使用 `alert()` 和 `confirm()`。
6. 表格、卡片、按钮、输入框、Tab、Badge、统计卡片等组件缺少统一规格。
7. 移动端只是简单隐藏侧栏和右栏，没有重新设计移动端主流程。
8. 缺少浏览器截图级视觉验收流程。
9. 教师端病例管理尚未完成，因此商业级后台还缺一个核心管理模块。
10. 旧组件和旧页面仍存在，容易干扰后续重构判断。

## 二、商业级改造总原则

这个系统不是营销官网，而是护理教育训练工具。因此 UI 方向应该是：

- 专业、清爽、可信。
- 信息密度适中，方便学生反复训练、教师快速扫视。
- 医疗教育感强，但不要做成医院 HIS 那种冷冰冰的表格系统。
- 使用真实产品工作台作为第一屏，不要做营销式 Landing Page。
- 避免大面积单一蓝色，主色可以是医疗蓝，但要用中性灰、青绿色、琥珀色、红色状态色建立层次。
- 尽量使用代码原生 UI，不要把界面做成静态图片。
- 图标继续使用 `lucide-react`，但要统一尺寸、线宽、颜色和按钮容器。
- 控件密度要稳定，按钮、表格行、导航项、卡片、输入框不能在 hover 或内容变化时抖动。
- 卡片圆角建议收敛到 8px 左右，形成更成熟的 SaaS / 教学管理工具质感。

推荐视觉关键词：

- Clinical calm
- Education dashboard
- Clean SaaS
- Human-centered training
- High-trust medical blue
- Precise but warm

不推荐：

- 过度插画化。
- 大面积渐变背景。
- 到处都是卡片和嵌套卡片。
- 纯蓝色单调界面。
- 使用 emoji。
- 营销式 Hero。
- 无意义的装饰光斑、漂浮球、玻璃拟态。

## 三、必须先做设计方案，再写代码

后续 AI 如果要真正开始界面重构，请先做设计方案，不要直接在 CSS 上试错。

建议流程：

1. 截取当前页面基准图。

   至少截图：

   - 登录页。
   - 学生 Dashboard。
   - 训练对话页。
   - 评分弹窗。
   - 记录详情页。
   - 教师后台概览。
   - 教师训练记录表格。
   - 移动端学生 Dashboard。
   - 移动端训练页。

2. 生成或绘制完整设计概念。

   如果可用图像生成能力，建议先生成以下设计概念图：

   - 学生端 Dashboard 桌面版。
   - 学生训练对话页桌面版。
   - 评分报告弹窗或详情页。
   - 教师端管理 Dashboard 桌面版。
   - 教师训练记录/学生管理表格页。
   - 移动端学生 Dashboard。
   - 移动端训练对话页。

3. 从设计概念中提取设计系统。

   必须明确：

   - 色彩 token。
   - 字体层级。
   - 间距系统。
   - 圆角规格。
   - 阴影规格。
   - 表格规格。
   - 卡片规格。
   - 按钮规格。
   - 表单规格。
   - 导航规格。
   - 空状态规格。
   - Toast、Dialog、Modal、Drawer 等反馈组件规格。

4. 再按页面分批改造。

   不要一次性重写所有页面。先搭 Shell 和组件系统，再逐页迁移。

5. 每完成一个页面就启动浏览器验收。

   验收必须包含：

   - 桌面视口。
   - 平板或窄屏。
   - 手机视口。
   - 空数据状态。
   - 加载状态。
   - 失败状态。
   - 交互状态。

## 四、建议新增前端结构

当前样式过于集中，建议逐步改为更清晰的结构。

推荐目录：

```text
frontend/src/
├── components/
│   ├── app/
│   │   ├── AppShell.jsx
│   │   ├── AppHeader.jsx
│   │   ├── AppSidebar.jsx
│   │   ├── MobileNav.jsx
│   │   └── PageTitle.jsx
│   ├── ui/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── Tabs.jsx
│   │   ├── StatTile.jsx
│   │   ├── EmptyState.jsx
│   │   ├── LoadingState.jsx
│   │   ├── ToastProvider.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   └── FormField.jsx
│   ├── student/
│   │   ├── CasePicker.jsx
│   │   ├── LatestFeedbackPanel.jsx
│   │   ├── TrainingProgressPanel.jsx
│   │   └── QuickAskPanel.jsx
│   ├── teacher/
│   │   ├── TeacherOverview.jsx
│   │   ├── StudentTable.jsx
│   │   ├── TrainingRecordTable.jsx
│   │   └── CaseAdminPanel.jsx
│   └── training/
│       ├── PatientHeader.jsx
│       ├── ConversationList.jsx
│       ├── MessageBubble.jsx
│       ├── TrainingInputBar.jsx
│       ├── InquiryProgressRail.jsx
│       └── ScoreReport.jsx
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── pages.css
└── pages/
```

也可以继续保持单 CSS 文件，但必须先整理出 token 和组件类，避免继续堆一次性样式。

## 五、设计系统建议

### 1. 色彩

推荐 token：

```css
:root {
  --color-bg: #f6f8fb;
  --color-surface: #ffffff;
  --color-surface-subtle: #f9fafb;
  --color-border: #e5e7eb;
  --color-border-strong: #d1d5db;

  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-text-subtle: #9ca3af;
  --color-text-inverse: #ffffff;

  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-soft: #eff6ff;

  --color-clinical: #0f766e;
  --color-clinical-soft: #ecfdf5;

  --color-warning: #d97706;
  --color-warning-soft: #fffbeb;

  --color-danger: #dc2626;
  --color-danger-soft: #fef2f2;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
}
```

注意：

- 不要让界面只剩蓝色。
- 危险操作如“结束训练”用红色，但要克制。
- 评分优点用绿色，待改善用琥珀色，漏问内容用红色，建议用蓝色。

### 2. 字体

推荐：

```css
font-family:
  Inter,
  "PingFang SC",
  "Microsoft YaHei",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  sans-serif;
```

建议层级：

- 页面标题：24px / 32px / 700。
- 分区标题：18px / 26px / 700。
- 卡片标题：15px / 22px / 650。
- 正文：14px / 22px / 400。
- 表格：13px / 20px / 400。
- 辅助说明：12px / 18px / 400。
- 按钮：13px 或 14px / 600。

注意：

- 不要用随视口缩放的字体。
- 不要使用负 letter-spacing。
- 表格、按钮、输入框、导航的字体要单独定义，不能依赖浏览器默认。

### 3. 间距

建议统一：

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

页面布局建议：

- 桌面主内容左右 padding：32px。
- 卡片内部 padding：16px 到 20px。
- 表格行高：44px 到 52px。
- 导航项高度：40px 到 44px。
- 输入框高度：40px 到 44px。

### 4. 圆角和阴影

商业管理系统建议更克制：

- 小控件：6px。
- 卡片、表格容器、输入框：8px。
- 弹窗：12px。
- 不要所有元素都 16px 圆角。
- 阴影要轻，主要靠边框和留白建立层次。

### 5. 组件状态

每个组件至少有：

- 默认态。
- hover。
- active / selected。
- disabled。
- loading。
- error。
- empty。
- focus-visible。

尤其是：

- Button。
- Nav item。
- Case card。
- Table row。
- Tabs。
- Inputs。
- Chat input。
- Score item。

## 六、统一 AppShell

当前 `DashboardHome.jsx` 使用 Dashboard 三栏布局，其他页面使用 `Layout.jsx` 侧栏布局。建议统一成新的 `AppShell.jsx`。

### AppShell 桌面结构

推荐：

```text
┌───────────────────────────────────────────────────────────────┐
│ 顶部栏：Logo / 当前模块 / 用户 / 退出                          │
├───────────────┬───────────────────────────────────────────────┤
│ 左侧导航       │ 主内容区                                      │
│ 训练工作台     │ PageTitle                                     │
│ 病例训练       │ 页面主体                                      │
│ 训练记录       │                                               │
│ 护理问答       │                                               │
│ 训练统计       │                                               │
│ 管理后台       │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

### AppShell 移动端结构

推荐：

```text
┌────────────────────────────┐
│ 顶部栏：Logo / 用户菜单     │
├────────────────────────────┤
│ 页面内容                    │
├────────────────────────────┤
│ 底部导航：训练 / 记录 / QA  │
└────────────────────────────┘
```

注意：

- 移动端不要只隐藏导航，要提供底部导航或抽屉导航。
- 教师端移动端至少保证查看概览、记录列表、学生列表可用。
- 训练对话页仍应使用独立全屏布局，不强行塞进 AppShell。

## 七、学生端页面优化方案

### 1. 登录页

当前文件：

- `frontend/src/pages/Login.jsx`

目标：

- 第一眼明确这是“护理病史采集训练平台”。
- 登录表单简洁可信。
- 视觉上有轻量医疗教育氛围。

建议改法：

1. 保留居中登录卡片，但背景不要过度花哨。
2. 左侧或顶部加入产品标识区：

   - 系统名称：虚拟患者训练系统。
   - 副标题：护理病史采集技能训练平台。

3. 登录卡片包含：

   - 用户名。
   - 密码。
   - 登录按钮。
   - 错误提示。

4. 可以增加“演示账号”折叠提示，但不要暴露在生产环境。
5. 登录失败不要使用浏览器 alert，使用 inline error。

验收：

- 1366px 桌面不空、不拥挤。
- 375px 手机表单不溢出。
- 错误提示不会推乱布局。

### 2. 学生 Dashboard

当前文件：

- `frontend/src/pages/DashboardHome.jsx`

目标：

- 作为学生训练工作台，而不是普通首页。
- 最重要动作是“选择病例并开始/继续训练”。

推荐布局：

```text
顶部：欢迎语 + 今日训练状态 + 快速操作

主区左侧：
- 当前/推荐病例
- 开始训练按钮
- 最近一次反馈摘要

主区右侧：
- 病例库简表
- 训练时长图
- 快速护理问答

下方：
- 历史训练记录摘要
- 能力雷达或 19 项评分趋势
```

建议改法：

1. 把“开始训练”做成最清晰的主行动。
2. 病例库从右侧小列表升级为可扫描列表：

   - 患者年龄、性别、主诉。
   - 难度或标签，若后端暂未支持可先不显示。
   - 不能显示诊断。

3. 最新反馈卡片展示：

   - 总分 / 满分。
   - 沟通技能。
   - 病史采集。
   - 1 条优势。
   - 1 条待改善。

4. 训练统计图保留，但视觉与卡片系统统一。
5. 快速问答作为辅助功能，不要抢主行动。
6. 有进行中训练时，应显示“继续训练”，优先级高于新建训练。

状态必须补齐：

- 无病例。
- 病例加载中。
- 无训练记录。
- 有进行中训练。
- 最新评分加载失败。

### 3. 病例选择页

当前文件：

- `frontend/src/pages/CaseSelect.jsx`

目标：

- 如果 Dashboard 已经承担病例选择，这个页面可以成为“病例库”完整视图。

建议改法：

1. 增加搜索和筛选：

   - 关键词。
   - 年龄段。
   - 性别。
   - 难度，待后端支持。

2. 病例卡片统一规格：

   - 症状标题。
   - 患者基础信息。
   - 主诉。
   - 训练目标提示。
   - 开始训练按钮。

3. 卡片不要过大，避免一屏只能看到 1 到 2 个病例。
4. 移动端使用纵向列表。

### 4. 训练对话页

当前文件：

- `frontend/src/pages/ChatTraining.jsx`

这是学生端最核心页面，必须重点优化。

目标：

- 像真实的护理问诊训练舱。
- 保持沉浸，但不能失去必要的训练辅助。

推荐桌面布局：

```text
┌─────────────────────────────────────────────────────────────┐
│ 返回 / 患者身份 / 病例主诉 / 训练计时 / 结束训练              │
├───────────────┬───────────────────────────┬─────────────────┤
│ 患者信息面板   │ 对话区                     │ 采集进度/提示     │
│ 年龄性别主诉   │ 消息气泡                   │ 主诉 现病史...    │
│ 隐藏诊断不显示 │ 输入栏固定底部              │                  │
└───────────────┴───────────────────────────┴─────────────────┘
```

如果担心太复杂，可以先做两栏：

- 中间对话区。
- 右侧训练辅助栏。

训练辅助栏建议：

- 已采集信息进度。
- 当前病例主诉。
- 问诊建议框架。
- 结束前检查。

注意：

- 不要直接把隐藏信息或诊断显示给学生。
- 右侧只显示“采集类别”，不要显示答案。

消息气泡建议：

- 学生消息：右侧，浅蓝或主色。
- 患者消息：左侧，白色卡片。
- 系统状态：居中小提示。
- 加载中：患者侧 typing 状态。
- 朗读按钮 hover 出现，但移动端要可点击。

输入栏建议：

- 固定底部。
- 支持发送、语音、清空。
- 发送中禁止重复提交。
- 输入框高度稳定。

结束训练建议：

- 使用自定义 ConfirmDialog，不要用 `confirm()`。
- 文案提示“结束后将生成评分，可能需要等待几十秒”。
- 如果未来有采集进度，可以提示漏问项。

### 5. 评分报告

当前文件：

- `frontend/src/components/ScoreCard.jsx`
- `frontend/src/pages/RecordDetail.jsx`

目标：

- 从弹窗式“结果展示”升级为“教学反馈报告”。

推荐结构：

```text
顶部：
- 总分 / 57
- 等级标签
- 训练时间
- 病例名称

中部：
- 沟通技能 14 项
- 病史采集 5 项
- 每项 1-3 分

反馈：
- 表现较好
- 需要改善
- 漏问内容
- 下次训练建议

底部：
- 查看对话回放
- 导出报告
- 再练一次
```

建议改法：

1. 弹窗适合训练结束即时反馈。
2. 记录详情页应做完整报告视图，不要只是对话回放加一个大分数。
3. 逐项评分可以做成可折叠列表，默认展开低分项。
4. 漏问内容要视觉上突出，但不能让用户有挫败感。
5. 建议文案区域宽度控制在可读范围。

### 6. 护理问答页

当前文件：

- `frontend/src/pages/QA.jsx`

目标：

- 像一个轻量 AI 导师，而不是普通聊天框。

建议改法：

1. 左侧或顶部提供推荐问题。
2. 对话区保持简洁。
3. 回答卡片增加：

   - 复制按钮。
   - 继续追问。
   - “用于训练提问”按钮，未来可跳转训练。

4. 输入框固定在底部或卡片底部。
5. Dashboard 快速提问跳转参数 `q` 继续保留。

## 八、教师端页面优化方案

教师端不能只是学生端的附属功能，应该是“教学管理工作台”。

### 1. 教师 Dashboard

当前教师登录也进入 `DashboardHome.jsx`，但这个页面更偏学生训练。

建议新增或改造：

- `frontend/src/pages/TeacherDashboard.jsx`

教师 Dashboard 应展示：

1. 班级训练总览：

   - 学生总数。
   - 总训练次数。
   - 已完成训练。
   - 平均得分。
   - 平均训练时长。

2. 学生表现排行或分层：

   - 高分学生。
   - 需要关注学生。
   - 长时间未训练学生。

3. 最新训练记录：

   - 学生姓名。
   - 病例。
   - 分数。
   - 状态。
   - 时间。
   - 查看报告。

4. 教学风险提示：

   - 多数学生低分的评分项。
   - 高频漏问内容。

5. 快捷操作：

   - 新增学生。
   - 导出记录。
   - 管理病例。

### 2. 教师管理后台

当前文件：

- `frontend/src/pages/Admin.jsx`

建议拆分当前 Admin：

```text
Admin
├── OverviewTab
├── RecordsTab
├── UsersTab
└── CasesTab
```

每个 Tab 不要写在一个巨大的 JSX 文件里。

推荐文件：

- `frontend/src/components/teacher/AdminOverviewTab.jsx`
- `frontend/src/components/teacher/AdminRecordsTab.jsx`
- `frontend/src/components/teacher/AdminUsersTab.jsx`
- `frontend/src/components/teacher/AdminCasesTab.jsx`

### 3. 训练记录表格

当前记录表可用，但商业级后台需要更强的表格能力。

建议增加：

- 搜索学生姓名或学号。
- 按病例筛选。
- 按状态筛选。
- 按分数区间筛选。
- 按时间排序。
- 分页。
- 批量导出。
- 表格空状态。
- 表格加载骨架屏。

表格视觉建议：

- 表头背景浅灰。
- 行高 48px。
- hover 轻微变色。
- 操作列固定宽度。
- 分数使用颜色标签。
- 状态使用 Badge。

### 4. 用户管理

建议：

- 注册新用户改为 Drawer 或 Modal。
- 用户表支持搜索。
- 角色使用 Badge。
- 新增成功用 Toast。
- 表单校验不要等后端返回才提示。

### 5. 病例管理

当前后端还没有完整接口，但商业级教师端必须有。

建议 UI 先设计好：

- 病例列表。
- 新建病例。
- 编辑病例。
- 启用/停用。
- 病例预览。

病例编辑表单建议分步骤：

1. 基本信息。
2. 患者资料。
3. 病史信息。
4. 隐藏信息。
5. 必问清单。
6. 评分标准预览。

注意：

- 学生端不显示诊断。
- 教师端可显示诊断字段，但如果当前病例 JSON 没有诊断字段，不要强行新增到学生侧。

## 九、全局交互升级

### 1. Toast

替代所有 `alert()`。

推荐场景：

- 登录失败。
- 开始训练失败。
- 消息发送失败。
- 评分失败。
- 导出成功/失败。
- 注册成功/失败。

### 2. ConfirmDialog

替代所有 `confirm()`。

推荐场景：

- 结束训练。
- 删除用户，未来如果支持。
- 停用病例，未来如果支持。

### 3. Loading 和 Skeleton

每个数据页都应有加载态：

- Dashboard 数据加载。
- 病例库加载。
- 训练记录加载。
- 教师统计加载。
- QA 回答生成中。
- 评分生成中。

### 4. EmptyState

空状态要有明确行动：

- 无训练记录：去开始训练。
- 无病例：联系教师或新增病例。
- 无统计：完成训练后查看。
- 无学生：添加学生。

### 5. ErrorState

不要只吞掉错误：

- API 失败要显示错误状态。
- 可以提供“重试”按钮。

## 十、响应式策略

必须重点测试：

- 1440px 桌面。
- 1366px 笔记本。
- 1024px 平板横屏。
- 768px 平板竖屏。
- 390px 手机。
- 360px 小屏手机。

### 桌面

- 保持完整 AppShell。
- 教师端表格可横向展示。
- 学生 Dashboard 可两栏或三栏。

### 平板

- 左侧导航可以收窄成 icon rail。
- 右侧辅助栏可下移。
- 表格应允许横向滚动或改为紧凑列。

### 手机

- 使用顶部栏 + 底部导航。
- Dashboard 变为纵向信息流。
- 训练页只保留患者头部、对话区、输入栏；采集进度可放进抽屉。
- 表格页可以改为列表卡片，但教师端重要字段不能丢。

移动端硬性要求：

- 不允许正文和按钮文字溢出。
- 不允许输入栏挡住最后一条消息。
- 不允许底部导航遮挡主要操作。
- 不允许表格把页面撑爆。

## 十一、视觉验收标准

后续 AI 完成每一批 UI 改造后，必须做浏览器验收。

建议使用 Playwright 或可用的浏览器工具截图。

至少检查：

1. 登录页桌面和手机。
2. 学生 Dashboard 桌面和手机。
3. 训练页桌面和手机。
4. 评分弹窗。
5. 记录详情页。
6. 教师 Dashboard 或 Admin。
7. 教师表格页。

验收重点：

- 页面是否有清晰主行动。
- 文本是否溢出。
- 按钮是否挤压。
- 卡片是否嵌套过多。
- 表格是否可读。
- 图标大小是否统一。
- 色彩是否过度单一。
- 关键状态是否完整。
- 移动端是否真正可用。
- 是否仍有 emoji。
- 是否仍有浏览器默认控件样式。

## 十二、建议实施顺序

### 第 0 阶段：准备和备份

1. 建议初始化 git 或让用户确认已有备份。
2. 截图保存当前页面。
3. 跑一次当前验证：

   ```powershell
   python -m compileall backend
   cd frontend
   npm.cmd install
   npm.cmd run lint
   npm.cmd run build
   ```

### 第 1 阶段：设计系统和 AppShell

1. 新增 token。
2. 新增 UI 基础组件：

   - Button。
   - Card。
   - Badge。
   - Tabs。
   - Table。
   - EmptyState。
   - LoadingState。
   - Toast。
   - ConfirmDialog。

3. 新增统一 `AppShell.jsx`。
4. 先迁移 `History.jsx` 或 `Stats.jsx` 这种风险较低页面验证风格。

### 第 2 阶段：学生端核心体验

1. 改造 `DashboardHome.jsx`。
2. 改造 `CaseSelect.jsx`。
3. 改造 `ChatTraining.jsx`。
4. 改造 `ScoreCard.jsx` 和 `RecordDetail.jsx`。
5. 改造 `QA.jsx`。

### 第 3 阶段：教师端核心体验

1. 新增或改造教师 Dashboard。
2. 拆分 `Admin.jsx`。
3. 优化训练记录表格。
4. 优化用户管理。
5. 设计病例管理 UI，并等待或同步开发后端病例管理接口。

### 第 4 阶段：全局状态和响应式

1. 替换全部 `alert()`。
2. 替换全部 `confirm()`。
3. 补齐加载、空、错误状态。
4. 完整移动端适配。
5. 检查所有页面滚动、遮挡、溢出。

### 第 5 阶段：性能和代码质量

1. 页面懒加载。
2. 拆分 recharts 和后台模块。
3. 清理旧组件。
4. 清理未使用 CSS。
5. 构建包拆分。

## 十三、具体文件修改建议

### 优先新建

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css`
- `frontend/src/components/app/AppShell.jsx`
- `frontend/src/components/app/AppHeader.jsx`
- `frontend/src/components/app/AppSidebar.jsx`
- `frontend/src/components/app/MobileNav.jsx`
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Card.jsx`
- `frontend/src/components/ui/Badge.jsx`
- `frontend/src/components/ui/Tabs.jsx`
- `frontend/src/components/ui/Table.jsx`
- `frontend/src/components/ui/EmptyState.jsx`
- `frontend/src/components/ui/LoadingState.jsx`
- `frontend/src/components/ui/ToastProvider.jsx`
- `frontend/src/components/ui/ConfirmDialog.jsx`

### 优先重构

- `frontend/src/pages/DashboardHome.jsx`
- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/components/ScoreCard.jsx`
- `frontend/src/styles/index.css`

### 可拆分

- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/DashboardHome.jsx`
- `frontend/src/pages/ChatTraining.jsx`

### 可删除前必须确认无引用

- `frontend/src/pages/Home.jsx`
- `frontend/src/components/Avatar.jsx`
- `frontend/src/components/ChatBubble.jsx`
- `frontend/src/components/VoiceButton.jsx`
- `frontend/src/components/FeatureCard.jsx`
- `frontend/src/components/CaseLibraryPanel.jsx`
- `frontend/src/components/TrainingMainPanel.jsx`
- `frontend/src/components/FeedbackPreviewCard.jsx`
- `frontend/src/components/QuestionQuickAskCard.jsx`

删除前运行：

```powershell
rg "Avatar|ChatBubble|VoiceButton|FeatureCard|CaseLibraryPanel|TrainingMainPanel|FeedbackPreviewCard|QuestionQuickAskCard|Home" frontend/src
```

## 十四、不要做的事情

1. 不要只改颜色和阴影就声称商业级完成。
2. 不要把学生端做成营销首页。
3. 不要在训练页显示诊断或隐藏信息答案。
4. 不要继续增加没有统一规格的一次性 CSS 类。
5. 不要把所有页面塞到一个大组件里。
6. 不要为了美观牺牲教师端表格的信息密度。
7. 不要在移动端简单隐藏核心信息。
8. 不要使用 emoji 作为正式图标。
9. 不要让按钮、表格、输入框使用浏览器默认字体和高度。
10. 不要引入过重 UI 库，除非确认项目愿意接受依赖和风格迁移成本。
11. 不要手工编辑 `frontend/dist/`，它是构建产物。

## 十五、最终商业级完成标准

可以认为 UI 达到阶段性商业级，必须满足：

1. 学生端和教师端都使用统一 AppShell 或统一视觉语言。
2. 每个页面都有清晰的信息层级和主行动。
3. 所有常用组件都有统一样式和交互状态。
4. 训练页具备沉浸式对话体验和适度训练辅助。
5. 评分报告具备教学反馈价值，不只是显示分数。
6. 教师端具备像样的管理工作台和可扫描表格。
7. 登录、Dashboard、训练、记录、QA、统计、管理后台在桌面和手机都可用。
8. 所有主要 API 加载、失败、空数据状态都有界面。
9. 无明显文字溢出、布局错位、控件遮挡。
10. `npm.cmd run lint` 和 `npm.cmd run build` 通过。
11. 浏览器截图验收通过。
12. 新代码结构清楚，后续添加病例管理、班级管理、评分分析不会继续恶化。

## 十六、后续 UI 问题记录

后续 AI 或开发者如果发现新的界面问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

页面：

- 

问题：

- 

设计判断：

- 

建议修改：

1. 
2. 
3. 

验收方式：

- 
```

