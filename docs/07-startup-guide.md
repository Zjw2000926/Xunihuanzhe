# 07 — 启动指南

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

## 环境要求

- Python 3.10+
- Node.js 18+
- pip 依赖: pytest, httpx（运行测试需要）
- 可访问 DeepSeek API (api.deepseek.com)

## 快速启动（开发模式）

### 1. 配置环境变量

编辑项目根目录的 `.env` 文件，填入 DeepSeek API Key：

```
DEEPSEEK_API_KEY=sk-your-actual-key
```

首次使用请将 `.env.example` 复制为 `.env` 后修改。`backend/config.py` 会通过 python-dotenv 自动加载。

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

首次启动自动创建数据库（WAL模式）和种子数据。
验证 WAL 模式：检查 `backend/` 目录是否出现 `data.db-wal` 和 `data.db-shm` 文件。

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`

## 生产部署（单机多核）

### 方式一：一键启动

双击项目根目录的 `start.bat`，使用 1 个 worker 启动后端（SQLite 单进程写入限制）。

### 方式二：前端构建 + 后端服务

```bash
cd frontend
npm run build
cd ..\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

构建后的前端静态文件（`frontend/dist/`）会被 FastAPI 自动检测并挂载。访问 `http://localhost:8000` 即可使用完整系统，无需单独启动前端 dev server。

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 教师 | admin | admin123 |
| 学生1 | student1 | 123456 |
| 学生2 | student2 | 123456 |
| 学生3 | student3 | 123456 |
| 学生4 | student4 | 123456 |
| 学生5 | student5 | 123456 |

## 云服务器部署

推荐：腾讯云轻量应用服务器（香港节点，免备案），最低 2核2G。

步骤：
1. 将整个项目目录上传到服务器
2. 在项目根目录修改 `.env`，填入 DeepSeek API Key
3. `cd frontend && npm install && npm run build`
4. `cd ../backend && pip install -r requirements.txt`
5. 运行 `start.bat` 或 `python -m uvicorn main:app --host 0.0.0.0 --port 80 --workers 1`
6. 云控制台防火墙开放 80 端口
7. 其他人通过 `http://<服务器公网IP>` 访问

## 常见问题

### pip安装超时
使用清华镜像：
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### bcrypt版本兼容问题
```bash
pip install bcrypt==4.1.3
```

### 数据库重置
删除 `backend/data.db`、`data.db-wal`、`data.db-shm` 并重启后端：
```bash
del backend\data.db*
```

### 前端API无法连接
生产模式（前端 build + 后端服务）不需要代理。开发模式确保 `frontend/vite.config.js` 代理配置正确。

### 验证 WAL 模式
```bash
dir backend\data.db*
```
确认出现 `data.db-wal` 和 `data.db-shm` 文件。

## 运行测试

### 后端 (pytest)
```bash
cd backend
pip install pytest httpx        # 首次运行
python -m pytest tests/ -v       # 40条测试
```

### 前端 (Vitest)
```bash
cd frontend
npm install                      # 首次运行
npx vitest run                   # 17条测试
```

**总计 57 条测试**，覆盖认证、训练流程、管理功能、前端组件。

## 添加新病例

**方式一（推荐）：教师后台在线管理** (v1.8)
1. 教师登录 → 管理后台 → 病例管理 → 添加病例
2. 填写结构化表单或上传 JSON 文件导入

**方式二：后端 JSON 文件**
1. 在 `backend/cases/` 下创建 `caseN.json`
2. 参照 `05-llm-design.md` 中的病例结构（含 `difficulty` 和 `time_limit` 字段）
3. 确保 `name` 为症状描述（不泄露诊断）
4. 重启后端自动导入

## 环境变量完整列表

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DEEPSEEK_API_KEY | 空 | DeepSeek API密钥（**必须配置**） |
| DEEPSEEK_BASE_URL | https://api.deepseek.com | API地址 |
| DEEPSEEK_MODEL | deepseek-chat | 模型名 |
| SECRET_KEY | (默认值) | JWT签名密钥（生产环境**必须修改**） |
| DATABASE_URL | sqlite:///data.db | 数据库连接 |
| LLM_MAX_RETRIES | 3 | LLM调用失败最大重试次数 |
| LLM_REQUEST_TIMEOUT | 90 | LLM请求默认超时(秒) |
| LLM_CONCURRENT_LIMIT | 10 | LLM并发调用上限 |
| LLM_CONNECTION_POOL_SIZE | 20 | HTTP连接池大小 |
| LLM_CONNECTION_KEEPALIVE | 10 | HTTP Keepalive连接数 |
| LLM_CHAT_TIMEOUT | 30 | 聊天请求超时(秒) |
| LLM_CHAT_MAX_TOKENS | 512 | 聊天最大输出token |
| LLM_SCORING_TIMEOUT | 120 | 评分请求超时(秒) |
| LLM_SCORING_MAX_TOKENS | 2048 | 评分最大输出token |
| ACCESS_TOKEN_EXPIRE_MINUTES | 480 | JWT过期时间(分钟) |
