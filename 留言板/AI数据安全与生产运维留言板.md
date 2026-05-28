# AI数据安全与生产运维留言板

> 目标：让系统从“本地演示项目”逐步达到学校试点和后续商用所需的数据安全、权限控制、部署运维、备份恢复和审计能力。  
> 面向后续接手的 AI 或开发者。请注意：一旦真实学生使用，训练记录、账号信息、对话内容、评分结果都属于需要认真保护的教学数据。

## 一、当前安全与运维风险

相关文件：

- `backend/config.py`
- `backend/main.py`
- `backend/auth.py`
- `backend/database.py`
- `backend/models.py`
- `backend/routers/auth.py`
- `backend/routers/export.py`
- `backend/routers/admin.py`
- `backend/routers/training.py`
- `frontend/src/api.js`
- `frontend/src/App.jsx`
- `docs/07-startup-guide.md`

当前风险：

1. `SECRET_KEY` 有开发默认值。
2. CORS 当前为 `allow_origins=["*"]`。
3. 没有 `.env.example` 和环境区分。
4. JWT 存储在 `localStorage`，存在 XSS 风险。
5. 缺少审计日志，教师查看、导出、注册用户等操作不可追踪。
6. 缺少数据库备份和恢复方案。
7. 缺少生产部署文档。
8. 缺少健康检查和运行状态监控。
9. 缺少速率限制，LLM 接口可能被刷。
10. 导出接口可能泄露过多数据。
11. 没有明确的数据保留和删除策略。
12. 当前不是 git 仓库，发布和回滚缺少基础。

## 二、安全目标

系统进入真实教学试点前，应达到：

1. API Key 和密钥不写入代码。
2. 生产环境不能使用默认 `SECRET_KEY`。
3. 只有白名单前端域名可以访问 API。
4. 学生只能访问自己的训练数据。
5. 教师访问、导出、评分复核等关键操作有审计记录。
6. 数据库定期备份，可恢复。
7. 训练数据导出可控。
8. LLM 调用有频率限制和成本保护。
9. 后端服务有健康检查和日志。
10. 部署过程可重复、可回滚。

## 三、环境变量与配置治理

### 1. 新增 `.env.example`

建议根目录或 `backend/` 下新增：

```env
ENV=development
APP_VERSION=1.6-polish

DATABASE_URL=sqlite:///./data.db

SECRET_KEY=replace-with-a-strong-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=480

DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

CORS_ORIGINS=http://localhost:3000

LLM_CHAT_CONCURRENCY=12
LLM_SCORING_CONCURRENCY=3
```

### 2. 修改 `backend/config.py`

建议增加：

- `ENV`
- `APP_VERSION`
- `CORS_ORIGINS`
- `LLM_CHAT_CONCURRENCY`
- `LLM_SCORING_CONCURRENCY`

生产环境校验：

```python
if ENV == "production" and SECRET_KEY == "virtual-patient-secret-key-change-in-production":
    raise RuntimeError("生产环境必须设置强随机 SECRET_KEY")
```

### 3. 不要提交真实 `.env`

确保 `.gitignore` 包含：

```gitignore
.env
.env.local
*.sqlite
*.db
```

注意：

- 当前 `backend/data.db` 在交付包中存在，真实生产不建议继续把数据库文件作为代码文件分发。

## 四、CORS 与前端部署安全

当前：

```python
allow_origins=["*"]
```

建议改为：

```python
from config import CORS_ORIGINS

allow_origins=CORS_ORIGINS
```

`.env` 中配置：

```env
CORS_ORIGINS=http://localhost:3000,https://your-school-domain.example
```

注意：

- 生产环境不要允许 `*`。
- 如果使用 Cookie 鉴权，更不能配 `*`。

## 五、认证与 Token 安全

### 1. 当前问题

前端将 JWT 存在 `localStorage`，如果前端出现 XSS，Token 容易被窃取。

### 2. 短期建议

1. 缩短 Token 有效期，例如 2 到 8 小时。
2. 登出时清理 Token。
3. 前端避免使用危险 HTML 注入。
4. 后端所有受保护接口继续使用 `get_current_user`。
5. 教师接口必须继续使用 `require_teacher`。

### 3. 中长期建议

改为 HttpOnly Cookie：

- Access Token 放 HttpOnly Cookie。
- SameSite=Lax 或 Strict。
- Secure=true。
- 增加 CSRF 防护。

需要修改：

- `backend/routers/auth.py`
- `frontend/src/api.js`
- CORS 配置。

### 4. 密码策略

建议：

1. 教师创建学生账号时强制初始密码长度至少 8 位。
2. 首次登录要求改密码。
3. 增加修改密码接口。
4. 管理员重置密码要写审计日志。

接口建议：

```text
POST /api/auth/change-password
POST /api/admin/users/{user_id}/reset-password
```

## 六、权限边界

必须继续保持：

- 学生只能查看自己的训练记录。
- 学生只能在自己的训练记录里发消息。
- 学生只能结束自己的训练。
- 教师可以查看所有学生训练记录。
- 只有教师可以注册用户、导出全量记录。

建议新增测试：

1. 学生 A 不能查看学生 B 的 record。
2. 学生 A 不能导出学生 B 的 record。
3. 学生不能访问 `/api/admin/users`。
4. 学生不能导出全量 CSV。
5. 教师不能直接伪造学生身份发送训练消息。

推荐测试目录：

```text
backend/tests/test_permissions.py
```

## 七、审计日志

### 1. 为什么需要

真实教学数据中，教师查看、导出、修改评分、注册用户等操作应可追踪。

### 2. 新增模型

建议在 `backend/models.py` 增加：

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(80), nullable=False)
    resource_type = Column(String(80), nullable=True)
    resource_id = Column(Integer, nullable=True)
    ip_address = Column(String(80), nullable=True)
    user_agent = Column(Text, nullable=True)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

### 3. 需要记录的操作

必须记录：

- 教师注册用户。
- 教师导出全部训练记录。
- 用户导出单条训练记录。
- 教师查看学生详情，视学校要求决定。
- 教师复核或修改评分。
- 教师新增/编辑/停用病例。
- 登录失败次数过多。
- 管理员重置密码。

### 4. 接口建议

新增教师查看审计日志：

```text
GET /api/admin/audit-logs
```

支持过滤：

- 用户。
- 操作类型。
- 时间范围。
- resource_type。

## 八、数据导出安全

当前导出接口：

- `GET /api/export/records`
- `GET /api/export/record/{record_id}`

建议：

1. 全量导出仅教师可用，当前已满足。
2. 导出前写审计日志。
3. 导出字段最小化，不导出不必要敏感字段。
4. 文件名不要包含学生完整身份敏感信息。
5. 未来支持按班级、时间、病例过滤导出。
6. 大量数据导出改为后台任务。

可选增强：

- 导出文件加水印字段，例如导出人、导出时间。
- 导出前二次确认。
- 导出权限单独配置，不是所有教师都能导出。

## 九、数据备份与恢复

### 1. SQLite 阶段

如果短期仍使用 SQLite：

1. 每天备份 `backend/data.db`。
2. 备份文件命名：

   ```text
   backups/data-YYYYMMDD-HHMMSS.db
   ```

3. 备份前最好暂停写入或使用 SQLite backup API。
4. 发布新版本前必须手动备份。

### 2. PostgreSQL 阶段

推荐：

```bash
pg_dump -Fc virtual_patient > backups/virtual_patient_$(date +%Y%m%d_%H%M%S).dump
```

恢复：

```bash
pg_restore -d virtual_patient backups/xxx.dump
```

### 3. 备份策略

建议：

- 每日自动备份。
- 保留最近 14 到 30 天。
- 重要试点前手动备份。
- 备份文件定期复制到另一台机器或安全存储。

### 4. 恢复演练

必须定期验证备份能恢复。

验收：

- 能恢复用户。
- 能恢复病例。
- 能恢复训练记录。
- 能恢复消息和评分。

## 十、数据库迁移与版本发布

当前使用 `Base.metadata.create_all()`，不适合生产迭代。

建议：

1. 引入 Alembic。
2. 所有表结构变更走 migration。
3. 发布前备份数据库。
4. 发布后执行迁移。
5. 失败时可以回滚代码和数据库。

发布流程建议：

```text
1. 拉取代码
2. 停止 worker
3. 备份数据库
4. 安装依赖
5. 执行迁移
6. 构建前端
7. 重启后端
8. 重启 worker
9. 健康检查
10. 抽样登录测试
```

## 十一、日志与错误追踪

### 1. 后端日志

建议记录：

- 请求路径。
- HTTP 状态码。
- 耗时。
- 当前用户 ID。
- 用户角色。
- record_id。
- LLM 调用耗时。
- LLM 错误类型。
- 评分任务状态。

不要记录：

- API Key。
- 密码。
- 完整 JWT。
- 完整学生对话内容。
- 完整病例隐藏信息。

### 2. 结构化日志

建议输出 JSON 或规范 key-value：

```text
event=llm_call user_id=2 record_id=10 elapsed=5.2 status=success
```

### 3. 前端错误

前端应统一展示错误，不要只用 `alert()`。

建议配合：

- Toast。
- ErrorState。
- 重试按钮。

未来可接入：

- Sentry。
- OpenTelemetry。
- Prometheus + Grafana。

## 十二、健康检查与监控

### 1. 新增健康检查

新增：

```text
GET /health
```

返回：

```json
{
  "status": "ok",
  "version": "1.6-polish",
  "database": "ok"
}
```

如果引入 Redis：

```json
{
  "redis": "ok"
}
```

注意：

- 普通健康检查不要调用 DeepSeek，避免消耗费用。

### 2. 管理员运行状态

教师或管理员后台可显示：

- 今日登录人数。
- 当前进行中训练数。
- 当前评分中任务数。
- 今日 LLM 调用次数。
- LLM 失败次数。
- 平均回复时间。
- 平均评分时间。

这些数据可先从日志或数据库统计。

## 十三、速率限制与成本保护

LLM 接口有费用和速率限制，必须保护。

### 1. 聊天接口限制

建议：

- 同一训练记录同一时间只能有一个患者回复生成中。
- 同一学生每 2 到 3 秒最多发送 1 条消息。
- 消息长度限制 500 字。
- 单次训练最大轮数可配置，例如 30 轮。

### 2. QA 接口限制

建议：

- 同一用户每分钟最多 10 次。
- 同一问题可缓存。

### 3. 评分接口限制

建议：

- 同一记录不能重复评分。
- 评分失败最多自动重试 1 次。
- 手动重试需要教师或记录所有者触发。

### 4. 成本统计

未来可记录：

- 每日聊天调用次数。
- 每日评分调用次数。
- 每日 QA 调用次数。
- 粗略 token 估算。

## 十四、生产部署建议

### 1. 推荐结构

```text
Nginx
  -> frontend/dist
  -> backend FastAPI

Backend
  -> PostgreSQL
  -> Redis
  -> DeepSeek

Worker
  -> scoring queue
```

### 2. Docker Compose

建议新增：

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`

服务：

- `nginx`
- `backend`
- `worker`
- `postgres`
- `redis`

### 3. HTTPS

生产环境必须使用 HTTPS：

- Nginx + 证书。
- 或学校统一网关。

如果仍是校内局域网试点，也建议至少使用可信内网部署和账号控制。

## 十五、数据保留与删除策略

需要和学校或项目负责人确认：

1. 学生训练记录保留多久。
2. 学生毕业或课程结束后是否删除。
3. 教师导出数据后如何管理。
4. 是否允许学生删除自己的训练记录。
5. 研究用途的数据是否需要脱敏。

建议技术实现：

- `training_records.deleted_at` 软删除。
- `users.is_active` 停用账号。
- 导出研究数据时脱敏姓名和学号。

## 十六、最小生产化实施顺序

### 第 1 阶段：配置和密钥安全

1. 新增 `.env.example`。
2. 生产环境禁止默认 `SECRET_KEY`。
3. CORS 改为白名单。
4. 文档更新环境变量配置。

### 第 2 阶段：权限和审计

1. 增加权限测试。
2. 新增审计日志模型。
3. 导出、注册、评分复核写审计日志。
4. 教师端可查看审计记录。

### 第 3 阶段：备份和迁移

1. 引入 Alembic。
2. 迁移 PostgreSQL。
3. 建立备份脚本。
4. 做一次恢复演练。

### 第 4 阶段：运行监控

1. 增加 `/health`。
2. 增加结构化日志。
3. 记录 LLM 耗时和失败。
4. 教师后台显示基础运行状态。

### 第 5 阶段：部署和发布流程

1. Nginx 部署前端和反向代理。
2. 后端多 worker。
3. 评分 worker 独立运行。
4. Docker 或 systemd 守护。
5. 发布前备份、发布后健康检查。

## 十七、验收标准

可以认为数据安全和生产运维达到阶段性可用，需要满足：

1. 真实 Key 和密钥不在代码中。
2. 生产环境不能用默认 `SECRET_KEY`。
3. CORS 已改为白名单。
4. 学生越权访问测试失败，即不能访问他人数据。
5. 教师关键操作有审计日志。
6. 数据库有自动备份。
7. 至少完成一次恢复演练。
8. 有健康检查接口。
9. 后端日志能定位请求失败和 LLM 失败。
10. 导出操作可追踪。
11. 发布流程有备份和回滚方案。
12. 前端对网络错误和登录过期有明确提示。

## 十八、注意事项

1. 不要把真实 API Key 写入任何 Markdown、代码或截图。
2. 不要把完整 JWT 打进日志。
3. 不要让学生通过修改 URL 查看他人记录。
4. 不要在没有备份的情况下改数据库结构。
5. 不要把生产数据库文件随代码包分发。
6. 不要长期使用 `allow_origins=["*"]`。
7. 不要把导出权限默认开放给所有角色。
8. 不要在日志中保存完整病史对话，除非有明确合规要求和脱敏策略。
9. 不要没有恢复演练就认为备份可靠。
10. 不要在课堂试点当天首次尝试新部署方案。

## 十九、后续安全与运维问题记录

后续 AI 或开发者如果发现安全或运维问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

问题类型：

- 密钥 / 权限 / 数据导出 / 备份 / 部署 / 日志 / 监控 / 其他

问题：

- 

影响：

- 

涉及文件或接口：

- 

建议修改：

1. 
2. 
3. 

验证方式：

- 
```

