# 03 — 数据库设计

> 适用版本: v1.16-stable | 最后更新: 2026-05-27

数据库：SQLite (WAL 模式)，文件路径 `backend/data.db`

---

## 数据库配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| journal_mode | WAL | 写操作不阻塞读，支持高并发 |
| synchronous | NORMAL | 平衡安全与性能 |
| busy_timeout | 5000ms | 锁等待超时 |
| foreign_keys | ON | 外键约束 |
| poolclass | QueuePool | 连接池复用 |
| pool_size | 5 | 核心连接数 |
| max_overflow | 15 | 峰值可扩展连接 |
| pool_pre_ping | True | 连接前检测有效性 |
| pool_recycle | 3600s | 每小时回收连接 |

## 索引

### 单列索引（ORM Column 定义）
- users.username (UNIQUE)
- users.id (PK)
- cases.id (PK)
- training_records.id (PK)
- messages.id (PK)
- scores.id (PK)
- scores.record_id (UNIQUE)
- notes.id (PK)

### 复合索引（v1.6-concurrent 新增）
| 索引名 | 表 | 列 | 用途 |
|--------|-----|-----|------|
| ix_msg_record_created | messages | (record_id, created_at) | 对话加载热路径 |
| ix_tr_user_status | training_records | (user_id, status) | 学生记录列表 |
| ix_tr_status | training_records | (status) | 管理员统计 |

---

## ER关系

```
User (1) ──→ (N) TrainingRecord (1) ──→ (1) Case
                    │
                    ├──→ (N) Message
                    ├──→ (1) Score
                    └──→ (N) Note
```

---

## 表结构

### users — 用户表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 登录账号 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt哈希密码 |
| role | VARCHAR(10) | NOT NULL, DEFAULT "student" | student / teacher |
| display_name | VARCHAR(50) | NOT NULL | 显示姓名 |
| student_id | VARCHAR(30) | NULLABLE | 学号 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

种子数据：
- admin / admin123 (teacher)
- student1~5 / 123456 (student)

### cases — 病例表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 病例ID |
| name | VARCHAR(100) | NOT NULL | 病例名称（症状描述，不泄露诊断） |
| description | TEXT | NULLABLE | 病例简介 |
| case_data | JSON | NOT NULL | 完整病例数据（患者信息/病史/难度/时限/评分标准等） |
| created_at | DATETIME | DEFAULT NOW | |

### training_records — 训练记录表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 记录ID |
| user_id | INTEGER | FK→users.id | 学生ID |
| case_id | INTEGER | FK→cases.id | 病例ID |
| status | VARCHAR(20) | DEFAULT "in_progress" | in_progress / completed |
| scoring_status | VARCHAR(20) | NULLABLE | pending / processing / completed / failed |
| scoring_error | VARCHAR(500) | NULLABLE | 评分失败原因 |
| start_time | DATETIME | DEFAULT NOW | 开始时间 |
| end_time | DATETIME | NULLABLE | 结束时间 |

### messages — 对话消息表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 消息ID |
| record_id | INTEGER | FK→training_records.id | 所属训练 |
| role | VARCHAR(10) | NOT NULL | student / patient |
| content | TEXT | NOT NULL | 消息内容 |
| created_at | DATETIME | DEFAULT NOW | 时间戳 |

### scores — 评分表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 评分ID |
| record_id | INTEGER | FK→training_records.id, UNIQUE | 所属训练（一对一） |
| total_score | FLOAT | NOT NULL | 总分 (100分制) |
| detail_scores | JSON | NULLABLE | 分项得分（含逐项评分 + evidence/reason） |
| strengths | JSON | NULLABLE | 优点列表 |
| weaknesses | JSON | NULLABLE | 不足列表 |
| missed_content | JSON | NULLABLE | 漏问内容列表 |
| suggestions | TEXT | NULLABLE | 改进建议文本 |
| rubric_version | VARCHAR(50) | NULLABLE | 评分标准版本 (如 nursing_history_v1@1.0) |
| model_name | VARCHAR(50) | NULLABLE | 评分所用模型 |
| prompt_version | INTEGER | NULLABLE | Prompt 版本号 |
| score_scale | INTEGER | DEFAULT 100 | 评分制 (100 = 百分制) |
| review_status | VARCHAR(20) | DEFAULT "pending" | 教师复核状态 (pending / reviewed) |
| reviewed_by | INTEGER | FK→users.id, NULLABLE | 复核人 |
| reviewed_at | DATETIME | NULLABLE | 复核时间 |
| review_detail_scores | JSON | NULLABLE | 复核后的分项得分 |
| review_comment | TEXT | NULLABLE | 复核备注 |
| created_at | DATETIME | DEFAULT NOW | |

detail_scores结构（v1.14+ 新版，100分制）：

```json
{
  "沟通技能": {
    "score": 65,
    "max": 74,
    "items": [
      {"id": "comm_01", "name": "学生与病人打招呼并问候", "score": 3, "evidence": "对话中的具体证据(30-80字)", "reason": "评分理由(20-50字)"},
      {"id": "comm_02", "name": "学生询问病人的姓名和个人信息", "score": 2, "evidence": "...", "reason": "..."}
    ]
  },
  "病史采集": {
    "score": 21,
    "max": 26,
    "items": [...]
  }
}
```

旧版格式（legacy_100，总分已是 100 分制但维度分为原始分数）：
```json
{
  "沟通技能": 36,
  "病史采集": 12
}
```

### llm_call_logs — LLM调用审计日志表 (v1.12+)
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 日志ID |
| user_id | INTEGER | FK→users.id, NULLABLE | 触发调用的用户 |
| record_id | INTEGER | FK→training_records.id, NULLABLE | 关联训练记录 |
| case_id | INTEGER | FK→cases.id, NULLABLE | 关联病例 |
| purpose | VARCHAR(30) | NOT NULL | 调用目的 (chat / scoring / qa) |
| provider | VARCHAR(20) | NOT NULL | LLM 提供商 (deepseek) |
| model | VARCHAR(50) | NOT NULL | 模型名 (deepseek-chat) |
| temperature | FLOAT | NOT NULL | 温度参数 |
| max_tokens | INTEGER | NOT NULL | 最大 token 数 |
| input_chars | INTEGER | NULLABLE | 输入字符数 |
| output_chars | INTEGER | NULLABLE | 输出字符数 |
| estimated_input_tokens | INTEGER | NULLABLE | 估算输入 token |
| estimated_output_tokens | INTEGER | NULLABLE | 估算输出 token |
| estimated_cost | FLOAT | NULLABLE | 估算费用(USD) |
| latency_ms | INTEGER | NULLABLE | 调用延迟(毫秒) |
| status | VARCHAR(20) | NOT NULL | success / error |
| error_type | VARCHAR(50) | NULLABLE | 错误类型 |
| error_message | VARCHAR(500) | NULLABLE | 错误信息 |
| request_chars | INTEGER | NOT NULL | 请求字符数 |
| response_chars | INTEGER | NULLABLE | 响应字符数 |
| meta | JSON | NULLABLE | 附加元数据 |
| created_at | DATETIME | DEFAULT NOW | |

### notes — 笔记表
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, 自增 | 笔记ID |
| record_id | INTEGER | FK→training_records.id | 所属训练 |
| user_id | INTEGER | FK→users.id | 作者 |
| content | TEXT | NOT NULL | 笔记内容 |
| created_at | DATETIME | DEFAULT NOW | |
| updated_at | DATETIME | DEFAULT NOW | |

---

## 数据初始化流程

1. 服务启动时检查 `users` 表是否为空
2. 若为空，执行种子数据插入：
   - 创建1个教师账号 + 5个学生测试账号
   - 从 `backend/cases/*.json` 读取病例数据并插入
3. 数据库文件自动创建在 `backend/data.db`
