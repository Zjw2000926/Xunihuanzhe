# AI开发留言板

> 面向后续接手本项目的 AI 或开发者。  
> 当前项目是“基于大语言模型的护理病史采集虚拟患者训练系统”，技术栈为 FastAPI + SQLite + React/Vite + DeepSeek。  
> 当前交付状态约为 `v1.6-polish`：主流程已闭环，但还未达到生产级。

## 一、接手前先了解当前状态

请优先阅读以下文档和代码：

1. `docs/README.md`
2. `docs/06-dev-log.md`
3. `docs/08-polish-handoff.md`
4. `backend/main.py`
5. `backend/services/llm_service.py`
6. `backend/services/scoring.py`
7. `frontend/src/App.jsx`
8. `frontend/src/pages/DashboardHome.jsx`
9. `frontend/src/pages/ChatTraining.jsx`
10. `frontend/src/components/ScoreCard.jsx`

当前核心业务流程：

1. 学生登录。
2. 在 Dashboard 选择病例。
3. 创建训练记录。
4. 学生与 DeepSeek 驱动的虚拟患者对话。
5. 学生结束训练。
6. 后端调用 DeepSeek 自动评分。
7. 前端展示 19 项 / 57 分评分报告。
8. 学生或教师查看训练记录、统计和导出数据。

当前数据库 `backend/data.db` 中已有种子账号、2 个病例、若干试跑记录。数据库里同时存在旧 100 分制评分和新 57 分制评分，因此前端 `ScoreCard.jsx` 已做新旧格式兼容，不要轻易删除这段兼容逻辑。

## 二、当前主要问题清单

### 1. 尚未完成端到端实测

问题：

- 文档中明确提到还没有完整走通“登录 -> 选病例 -> 对话 -> 结束评分 -> 查看报告”的浏览器端 E2E 测试。
- 后端和前端虽然主流程代码存在，但真实 DeepSeek Key、网络、评分 JSON 返回格式都可能导致运行时问题。

建议修改步骤：

1. 配置环境变量：

   ```powershell
   $env:DEEPSEEK_API_KEY="真实 DeepSeek API Key"
   $env:SECRET_KEY="开发测试可临时使用，生产必须强随机"
   ```

2. 启动后端：

   ```powershell
   cd backend
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

3. 启动前端：

   ```powershell
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```

4. 使用默认学生账号登录：

   - 用户名：`student1`
   - 密码：`123456`

5. 完整测试以下路径：

   - `/login`
   - `/home`
   - `/training/:recordId`
   - `/record/:id`
   - `/history`
   - `/stats`
   - `/qa`

6. 重点观察：

   - 训练开始后是否正确创建记录。
   - 首条患者问候是否保存到 `messages`。
   - 学生提问后 DeepSeek 是否返回患者回复。
   - 结束训练后是否能生成 `scores`。
   - 评分弹窗是否显示 57 分制逐项评分。
   - 记录详情页是否能显示对话回放和评分详情。
   - Dashboard 是否能显示最新完成记录的真实反馈。

7. 如果发现问题，请优先补充到本文件末尾的“后续问题记录”区。

验证命令：

```powershell
python -m compileall backend
cd frontend
npm.cmd run lint
npm.cmd run build
```

### 2. 评分 JSON 容错不足

问题位置：

- `backend/services/llm_service.py`
- `backend/services/scoring.py`

当前 `call_llm_json()` 只做了简单的 Markdown 代码块剥离，然后直接 `json.loads()`。如果 DeepSeek 返回前后解释文字、半角逗号错误、字段缺失、分数类型异常，评分会失败。

建议修改步骤：

1. 在 `backend/services/llm_service.py` 中新增更稳健的 JSON 提取函数。

   建议策略：

   - 先尝试直接 `json.loads()`。
   - 如果失败，从文本中提取第一个 `{` 到最后一个 `}` 之间的内容再解析。
   - 如果仍失败，抛出带原始文本片段的明确异常。

2. 在 `backend/services/scoring.py` 中增加评分结果校验函数。

   校验内容：

   - `total_score` 必须是数字。
   - `detail_scores` 必须包含“沟通技能”和“病史采集”。
   - “沟通技能”满分为 42，“病史采集”满分为 15。
   - 每个 item 的 `score` 必须在 1 到 3 之间。
   - 如果模型返回的类别总分和逐项求和不一致，优先以逐项求和重新计算。
   - `total_score` 应等于两个类别分数之和，最大 57。

3. 给评分失败增加可恢复状态。

   当前 `training_records.status` 只有：

   - `in_progress`
   - `completed`

   建议新增：

   - `scoring`
   - `scoring_failed`

   由于当前没有迁移工具，短期可以仍使用字符串字段直接写入；中长期应引入 Alembic。

4. 修改 `end_training()` 流程。

   位置：`backend/routers/training.py`

   推荐逻辑：

   - 学生点击结束训练。
   - 状态先改为 `scoring`。
   - 调用评分。
   - 成功后改为 `completed`。
   - 失败后改为 `scoring_failed`，保存错误信息。

5. 前端增加评分中和评分失败提示。

   修改位置：

   - `frontend/src/pages/ChatTraining.jsx`
   - `frontend/src/pages/RecordDetail.jsx`
   - `frontend/src/pages/History.jsx`

   展示建议：

   - `scoring`：显示“评分生成中，请稍候”。
   - `scoring_failed`：显示“评分失败，可重试评分”。

6. 增加一个重试评分接口。

   推荐新增：

   - `POST /api/training/{record_id}/score/retry`

   权限建议：

   - 学生只能重试自己的记录。
   - 教师可以重试所有记录。

### 3. 后端版本号与文档不一致

问题位置：

- `backend/main.py`
- `docs/README.md`
- `docs/06-dev-log.md`
- `docs/08-polish-handoff.md`
- `交付说明.md`

当前文档说版本是 `v1.6-polish`，但 FastAPI 应用写的是 `1.0.0`。

建议修改步骤：

1. 在 `backend/config.py` 增加：

   ```python
   APP_VERSION = os.getenv("APP_VERSION", "1.6-polish")
   ```

2. 在 `backend/main.py` 引入：

   ```python
   from config import APP_VERSION
   ```

3. 修改：

   ```python
   app = FastAPI(title="虚拟患者训练系统", version=APP_VERSION)
   ```

4. 根路径返回也使用同一版本：

   ```python
   return {"message": "虚拟患者训练系统 API", "version": APP_VERSION}
   ```

5. 文档中的版本号统一。

### 4. 生产安全配置不足

问题位置：

- `backend/config.py`
- `backend/main.py`
- `docs/07-startup-guide.md`

当前问题：

- `SECRET_KEY` 有开发默认值。
- CORS 使用 `allow_origins=["*"]`。
- 缺少 `.env.example`。
- 缺少请求速率限制。
- JWT 存储在 `localStorage`，存在 XSS 风险。

建议修改步骤：

1. 新增 `.env.example`：

   ```env
   DATABASE_URL=sqlite:///./data.db
   SECRET_KEY=replace-with-a-strong-random-secret
   DEEPSEEK_API_KEY=sk-your-key
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   DEEPSEEK_MODEL=deepseek-chat
   CORS_ORIGINS=http://localhost:3000
   ```

2. 在 `backend/config.py` 增加 CORS 配置读取：

   ```python
   CORS_ORIGINS = [
       item.strip()
       for item in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
       if item.strip()
   ]
   ```

3. 在 `backend/main.py` 中替换：

   ```python
   allow_origins=["*"]
   ```

   为：

   ```python
   allow_origins=CORS_ORIGINS
   ```

4. 生产环境中不要允许默认 `SECRET_KEY`。

   可在启动时检查：

   - 如果 `ENV=production` 且 `SECRET_KEY` 仍为默认值，则直接报错。

5. 中长期建议：

   - 改用 HttpOnly Cookie 存储 JWT。
   - 增加 CSRF 策略。
   - 给 `/api/chat`、`/api/qa`、`/api/training/*/end` 增加速率限制，避免 LLM 费用被刷。

### 5. 缺少数据库迁移机制

问题位置：

- `backend/database.py`
- `backend/models.py`
- `backend/data.db`

当前靠 `Base.metadata.create_all()` 自动建表，适合早期开发，但不适合后续迭代。

建议修改步骤：

1. 引入 Alembic：

   ```powershell
   pip install alembic
   alembic init migrations
   ```

2. 配置 Alembic 使用项目的 `DATABASE_URL` 和 `Base.metadata`。

3. 生成首个迁移：

   ```powershell
   alembic revision --autogenerate -m "initial schema"
   ```

4. 后续所有表结构变更都走迁移，不再要求删除 `data.db`。

5. 如果要新增评分失败原因字段，建议给 `training_records` 增加：

   - `score_error`：Text，可空。
   - `score_retry_count`：Integer，默认 0。

### 6. 教师病例管理功能未完成

当前病例通过 `backend/cases/case1.json` 和 `case2.json` 导入，教师后台不能新增、编辑、停用病例。

建议新增能力：

1. 后端新增病例管理接口。

   推荐文件：

   - 可继续使用 `backend/routers/cases.py`
   - 或新增 `backend/routers/case_admin.py`

   推荐接口：

   - `POST /api/cases`
   - `PUT /api/cases/{case_id}`
   - `PATCH /api/cases/{case_id}/status`
   - `DELETE /api/cases/{case_id}` 或软删除

2. 数据库模型补充字段。

   位置：`backend/models.py` 的 `Case`。

   建议字段：

   - `is_active`
   - `difficulty`
   - `created_by`
   - `updated_at`

3. 前端教师后台增加“病例管理” Tab。

   修改位置：

   - `frontend/src/pages/Admin.jsx`
   - `frontend/src/api.js`

4. 表单字段建议：

   - 病例名称。
   - 病例描述。
   - 患者姓名、年龄、性别。
   - 主诉。
   - 现病史。
   - 既往史。
   - 用药史。
   - 过敏史。
   - 家族史。
   - 社会史。
   - 沟通风格。
   - 隐藏信息。
   - 必问清单。

5. 关键注意事项：

   - 学生端病例卡不能显示诊断。
   - 病例名称建议继续使用症状导向，不要直接写“COPD”“糖尿病足”等诊断。
   - 隐藏信息只能在患者被问到时透露，需保留在 prompt 中。

### 7. 旧页面和遗留组件需要清理

当前遗留文件：

- `frontend/src/pages/Home.jsx`
- `frontend/src/components/Avatar.jsx`
- `frontend/src/components/ChatBubble.jsx`
- `frontend/src/components/VoiceButton.jsx`
- `frontend/src/components/FeatureCard.jsx`
- `frontend/src/components/CaseLibraryPanel.jsx`
- `frontend/src/components/TrainingMainPanel.jsx`
- `frontend/src/components/FeedbackPreviewCard.jsx`
- `frontend/src/components/QuestionQuickAskCard.jsx`

建议修改步骤：

1. 用 `rg` 确认是否仍被引用：

   ```powershell
   rg "Avatar|ChatBubble|VoiceButton|FeatureCard|CaseLibraryPanel|TrainingMainPanel|FeedbackPreviewCard|QuestionQuickAskCard|Home" frontend/src
   ```

2. 如果确认未引用，删除文件。

3. 清理 `frontend/src/styles/index.css` 中只为旧组件服务的 CSS 类。

4. 运行：

   ```powershell
   cd frontend
   npm.cmd run lint
   npm.cmd run build
   ```

5. 注意：

   - 不要误删 `DashboardHome.jsx`，这是当前首页。
   - 不要误删 `Layout.jsx`，子页面仍在使用侧边栏布局。

### 8. Dashboard 与 Sidebar 两套布局未统一

当前布局：

- Dashboard 首页：`Header + 三栏 Grid`
- 子页面：`Layout.jsx` 的左侧栏布局
- 训练页：独立全屏布局

问题：

- 产品体验不统一。
- Dashboard 首页和子页切换时视觉割裂。

建议修改路线：

1. 保留训练页独立全屏布局。
2. 将 `/history`、`/qa`、`/stats`、`/record/:id`、`/admin` 逐步迁移到 Dashboard 风格。
3. 可以重构一个新的通用壳组件：

   - `frontend/src/components/AppShell.jsx`

4. `AppShell` 建议包含：

   - 顶部 Header。
   - 左侧功能导航。
   - 主内容区。
   - 可选右侧区域。

5. 迁移顺序建议：

   1. `History.jsx`
   2. `Stats.jsx`
   3. `QA.jsx`
   4. `RecordDetail.jsx`
   5. `Admin.jsx`
   6. `CaseSelect.jsx`

6. 每迁移一个页面都跑一次页面自测，避免一次性大改导致难以定位问题。

### 9. 前端交互仍偏原型化

当前很多错误提示使用 `alert()` 或 `confirm()`。

问题位置示例：

- `frontend/src/pages/ChatTraining.jsx`
- `frontend/src/pages/DashboardHome.jsx`
- `frontend/src/pages/CaseSelect.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/RecordDetail.jsx`

建议修改步骤：

1. 新增通用 Toast 组件。

   推荐文件：

   - `frontend/src/components/ToastProvider.jsx`

2. 替换常见 alert：

   - 开始训练失败。
   - 发送消息失败。
   - 结束训练失败。
   - 导出失败。
   - 注册用户失败。

3. 新增通用 ConfirmDialog 组件，替代 `window.confirm()`。

4. 训练页结束按钮应弹出更明确的确认说明：

   - 结束后将不能继续编辑对话。
   - 系统会自动评分，可能需要等待几十秒。

### 10. 前端构建包过大

当前 `frontend/dist/assets/index-*.js` 约 675KB，Vite 曾提示超过 500KB。

建议修改步骤：

1. 在 `vite.config.js` 中考虑手动拆包：

   ```js
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           react: ["react", "react-dom", "react-router-dom"],
           charts: ["recharts"],
           icons: ["lucide-react"],
         },
       },
     },
   }
   ```

2. 对非首屏页面使用 React lazy：

   - `Admin`
   - `Stats`
   - `RecordDetail`
   - `QA`
   - `CaseSelect`

3. 不要为了减小包体积牺牲核心训练体验；优先拆分教师后台和图表相关模块。

### 11. 语音功能需要兼容性处理

当前使用浏览器 Web Speech API。

问题：

- Chrome 支持较好，其他浏览器不稳定。
- 语音识别错误只静默结束。

建议修改：

1. 页面加载时检测是否支持：

   - `window.SpeechRecognition`
   - `window.webkitSpeechRecognition`
   - `window.speechSynthesis`

2. 不支持时隐藏或禁用语音按钮，并给出轻量提示。

3. 识别错误时显示 Toast，而不是静默失败。

4. 长文本朗读时允许停止朗读。

### 12. 护理教育专业性还可以继续增强

当前已经围绕护理病史采集改造，但还可以提升教学价值。

建议方向：

1. 在训练页增加“已采集信息进度”。

   文件：

   - `frontend/src/pages/ChatTraining.jsx`
   - 后端可新增分析接口。

   展示内容：

   - 主诉。
   - 现病史。
   - 既往史。
   - 用药史。
   - 过敏史。
   - 家族史。
   - 社会史。
   - 心理社会评估。

2. 结束训练前提示学生是否确认结束。

   如果关键内容明显不足，可以提醒：

   - “你似乎还没有询问过敏史/用药史，仍要结束吗？”

3. 评分报告增加“下次训练建议提问模板”。

4. 教师端增加班级维度统计。

## 三、建议开发优先级

### 第一优先级：保证主流程稳定

1. 完成 E2E 测试。
2. 修复测试中发现的真实运行问题。
3. 增加评分 JSON 容错。
4. 增加评分失败状态和重试接口。

### 第二优先级：提升试点可用性

1. 教师病例管理。
2. 统一页面布局。
3. 替换 alert/confirm。
4. 补充 `.env.example` 和启动脚本。
5. 清理旧组件。

### 第三优先级：生产化

1. Alembic 数据库迁移。
2. PostgreSQL 支持。
3. Docker 部署。
4. CORS 白名单。
5. 速率限制。
6. 日志和错误追踪。
7. 更安全的 Token 存储方案。

## 四、推荐验证清单

每次修改后尽量执行：

```powershell
python -m compileall backend
cd frontend
npm.cmd run lint
npm.cmd run build
```

关键人工测试：

1. 学生登录。
2. 教师登录。
3. 学生选择病例并开始训练。
4. 学生发送至少 5 轮对话。
5. 结束训练并生成评分。
6. 查看评分弹窗。
7. 查看记录详情。
8. Dashboard 显示最新反馈。
9. 统计页显示训练时长。
10. 教师查看所有训练记录。
11. 教师导出 CSV。
12. QA 快速提问。

## 五、重要注意事项

1. 不要把真实 DeepSeek API Key 写进代码或文档。
2. 不要把病例诊断直接暴露给学生端。
3. 不要破坏新旧评分兼容逻辑，现有数据库仍有旧评分数据。
4. 修改数据库结构前先规划迁移，不要直接要求用户删除 `data.db`。
5. `frontend/dist/` 是构建产物，不要手工编辑。
6. 如果要删除旧组件，必须先用 `rg` 确认没有引用。
7. 当前项目不是 git 仓库，修改前最好由用户另行备份或初始化 git。
8. 护理教育场景下，不要让 AI 输出处方药建议或替代临床诊断。

## 六、后续问题记录

后续 AI 或开发者如果发现新问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

问题：

- 

涉及文件：

- 

建议修改：

1. 
2. 
3. 

验证方式：

- 
```

