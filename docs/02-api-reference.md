# 02 — API接口文档

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

Base URL: `http://localhost:8000/api`

所有接口（除登录/注册外）需在Header中携带 `Authorization: Bearer <token>`

**速率限制**:
| 接口 | 限制 | 超限响应 |
|------|------|----------|
| POST /auth/login | 同一IP 5分钟10次 | 429 "登录尝试过于频繁，请15分钟后再试" |
| POST /auth/register | 同一IP 每分钟5次 | 429 "注册请求过于频繁，请稍后再试" |
| POST /chat/{id}/message | 同一用户 每分钟6条 | 429 "消息发送过于频繁，请稍后再试" |
| POST /qa/ask | 同一用户 每分钟5次 | 429 "提问过于频繁，请稍后再试" |

**状态说明**: 
- ✅ 前端在用
- ⚠️ 后端保留但前端未使用（notes模块，v1.4移除前端使用）


---

## 认证模块 `/auth`

### POST /auth/login — 登录
```
Request:  { username, password }
Response: { access_token, token_type, role, display_name, user_id }
```
权限：公开

### POST /auth/register — 注册新用户（仅教师可操作）
```
Request:  { username, password, role, display_name, student_id? }
Response: { access_token, ... }
```
权限：教师

### GET /auth/me — 获取当前用户信息
```
Response: { id, username, role, display_name, student_id }
```
权限：登录

---

## 病例模块 `/cases`

### GET /cases — 获取病例列表
```
Response: [{ id, name, description, difficulty, patient_summary: { age, gender, chief_complaint } }]
```
- `difficulty`: 1=初级, 2=中级, 3=高级
- name和description不包含诊断信息，仅描述症状
权限：登录

### GET /cases/:id — 获取病例详情（含完整病例数据，用于LLM）
```
Response: { id, name, description, case_data: { ... } }
```
权限：登录

### GET /cases/manage/list — 教师病例管理列表
```
Response: [{ id, name, description, difficulty, patient_name, patient_age, patient_gender, chief_complaint, time_limit, created_at, training_count }]
```
含训练次数统计，按创建时间倒序
权限：教师

### POST /cases — 创建新病例
```
Request:  { case_data: { name, time_limit, description, patient_info, chief_complaint, opening_line, ... } }
Response: CaseManageItem
```
权限：教师

### PUT /cases/:id — 编辑病例
```
Request:  { case_data: { ... } }
Response: CaseManageItem
```
权限：教师

### DELETE /cases/:id — 删除病例
```
Response: { message: "病例已删除" }
```
仅当无训练记录时允许删除，否则返回 400
权限：教师

---

## 训练模块 `/training`

### POST /training/start — 开始训练
```
Request:  { case_id }
Response: { record_id, greeting }
```
- 创建训练记录，状态为 in_progress
- 返回虚拟患者的开场问候语
- 首次问候语自动保存为第一条消息
权限：学生

### POST /training/:id/end — 结束训练并触发后台评分
```
Response: { message, record_id, scoring_status: "pending" }
```
- 状态改为 completed，记录结束时间，scoring_status 设为 pending
- 后台异步调用 DeepSeek API 进行自动评分（19项条目：沟通技能14项/42分 + 病史采集5项/15分 = 原始57分制 → 转换为100分制）
- 评分完成后 scoring_status 变为 completed，失败则变为 failed
- 前端轮询 GET /training/records/:id 检测 scoring_status 变化（每3秒，最多40次）
权限：学生（仅自己）

### POST /training/:id/retry-scoring — 重新触发评分 (v1.15)
```
Response: { message, record_id, scoring_status: "pending" }
```
- 重新触发失败的评分（学生本人或教师可操作）
- 要求 status=completed 且 scoring_status 不在 pending/processing
权限：学生（仅自己）/ 教师

### GET /training/records — 训练记录列表
```
Query:  ?limit=50&offset=0&student_name=李明&case_id=1&status=completed&date_from=2026-05-01&date_to=2026-05-23
Response: [{ id, case_id, case_name, user_display_name, user_student_id, status, start_time, end_time, score_total }]
```
- 学生查看自己的，教师查看全部
- 教师可多维过滤：`student_name`（模糊搜索）、`case_id`、`status`、`date_from`、`date_to`
- 支持分页：limit (默认50, 最大200), offset (默认0)
- 使用 joinedload 预加载关联模型 (1次查询替代 1+3N 次)
权限：登录

### DELETE /training/records/:id — 删除训练记录 (v1.9)
```
Response: { message: "训练记录已删除" }
```
- 级联删除关联 messages、scores、notes
- 教师可删全部，学生仅可删自己的
权限：登录

### GET /training/records/:id — 单条训练记录详情
```
Response: { ..., time_limit, messages: [...], score: {...}, notes: [...], scoring_status, scoring_error, required_inquiries: [...] }
```
- 含完整对话记录、评分结果、笔记列表、病例时限、评分状态、必问内容清单
- 学生训练页可通过此接口轮询 scoring_status 检测评分完成
权限：登录（学生仅自己，教师全部）

### GET /training/records/:id/review — 获取评分复核信息 (v1.14)
```
Response: { score_id, review_status, reviewed_by_name, reviewed_at, original_detail_scores, review_detail_scores, review_comment }
```
权限：登录

### POST /training/records/:id/review — 提交评分复核 (v1.14)
```
Request:  { detail_scores?, comment? }
Response: { score_id, review_status: "reviewed", reviewed_by_name, reviewed_at, ... }
```
- 教师可逐项修改评分（review_detail_scores）+ 添加复核备注（review_comment）
- review_status 变为 "reviewed"，前端显示"教师已复核"徽章
权限：教师

---

## 对话模块 `/chat`

### POST /chat/:record_id/message — 发送消息（同步）
```
Request:  { content }
Response: { role: "patient", content }
```
- 保存学生消息 → 构建LLM上下文 → 调用DeepSeek → 保存患者回复
- 上下文包含完整System Prompt + 历史消息
权限：学生（仅自己训练，仅进行中）

### POST /chat/:record_id/message/stream — 发送消息（SSE流式）(v1.12)
```
Request:  { content }
Response: text/event-stream (data: {content} ... data: [DONE])
```
- 流式返回患者回复，前端逐字渲染 + 闪烁光标
- 流式完成后原子保存消息
- 首字延迟 <1s
权限：学生（仅自己训练，仅进行中）

---

## 笔记模块 `/notes`

### GET /notes/:record_id — 获取笔记列表
```
Response: [{ id, content, created_at, updated_at }]
```
权限：学生（自己）/ 教师

### POST /notes/:record_id — 保存笔记
```
Request:  { content }
Response: { id, content, created_at, updated_at }
```
权限：学生（仅自己，仅进行中）

### PUT /notes/:note_id — 更新笔记
### DELETE /notes/:note_id — 删除笔记
权限：学生（仅自己）

---

## 问答模块 `/qa`

### POST /qa/ask — 护理专业问答
```
Request:  { question }
Response: { answer }
```
- 调用DeepSeek API，System Prompt限定为护理教育导师角色
- 仅回答护理专业问题
权限：登录

---

## 统计模块 `/stats`

### GET /stats/duration?period=week|month|all — 训练时长统计
```
Response: { daily: [{ date, minutes }], total_minutes, total_sessions }
```
- 按日聚合训练时长
- 学生看自己的，教师看全部完成的
权限：登录

### GET /stats/trends?period=week|month|all — 训练趋势 (v1.10)
```
Response: { daily: [{ date, sessions, minutes, avg_score }], total_sessions, total_minutes, avg_score }
```
- 每日汇总训练次数、时长、平均得分
- 学生看自己的，教师看全部已完成
权限：登录

### GET /stats/teacher-summary — 教师视角学生汇总
```
Response: [{ student_id, display_name, student_code, total_sessions, total_minutes }]
```
权限：教师

### GET /stats/ranking — 学生成绩排名 (v1.9)
```
Response: [{ rank, user_id, display_name, student_id, total_sessions, avg_score, total_score, total_minutes }]
```
- 按平均分降序排列，含排名序号
- 前三名在 Stats.jsx 中显示金牌/银牌/铜牌图标
权限：教师

---

## 导出模块 `/export`

### GET /export/records — 导出所有训练记录CSV
```
Response: CSV文件 (含所有字段：学生/病例/得分/优缺点/漏问/建议/对话轮数)
```
权限：教师

### GET /export/record/:id — 导出单条记录详情TXT
```
Response: 文本文件 (元信息 + 完整对话 + 评分结果)
```
权限：学生（自己）/ 教师

---

## 管理模块 `/admin`

### GET /admin/users — 用户列表
权限：教师

### PUT /admin/users/:id — 编辑用户 (v1.9)
```
Request:  { display_name?, student_id?, role?, password? }
Response: { id, username, display_name, ... }
```
- 未填写的字段不修改；password 留空不修改密码
权限：教师

### DELETE /admin/users/:id — 删除用户 (v1.9)
```
Response: { message: "用户已删除" }
```
- 不能删除自己
权限：教师

### POST /admin/users/batch — 批量导入用户 (v1.9)
```
Request:  [ { username, password, display_name, role?, student_id? }, ... ]
Response: { created: N, skipped: N, errors: [...] }
```
- 密码最低 6 位，用户名不能重复，角色必须为 student 或 teacher
权限：教师

### GET /admin/stats — 统计概览
```
Response: { total_students, total_records, completed_records, average_score }
```
- v1.9: 仪表盘（教师）使用此接口展示概览卡片
权限：教师

### POST /admin/backup — 数据库备份 (v1.13)
```
Response: { message, file, size }
```
- 备份到 `backups/` 目录，保留最近 10 个
权限：教师

---

## 系统模块

### GET /api/health — 健康检查 (v1.13)
```
Response: { status: "ok", version: "1.15.0", database: "connected", timestamp }
```
- DB 连接失败时返回 503
权限：公开
