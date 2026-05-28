# AI评分可信度与教学质量优化留言板

> 目标：让自动评分不仅“能出分”，还要做到可信、可解释、可校准、可复核，并真正服务护理病史采集教学。  
> 面向后续接手的 AI 或开发者。请把评分系统视为教学评价系统，而不是普通 LLM 文本生成模块。

## 一、当前评分系统的主要风险

相关文件：

- `backend/services/llm_service.py`
- `backend/services/scoring.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/routers/training.py`
- `backend/routers/admin.py`
- `frontend/src/components/ScoreCard.jsx`
- `frontend/src/pages/RecordDetail.jsx`
- `frontend/src/pages/Admin.jsx`
- `backend/cases/case1.json`
- `backend/cases/case2.json`

当前系统已经从旧 100 分制升级为 19 项 / 57 分制：

- 沟通技能：14 项，每项 1-3 分，满分 42。
- 病史采集：5 项，每项 1-3 分，满分 15。

但当前仍存在以下问题：

1. 评分标准直接写在 Prompt 中，缺少独立版本管理。
2. 每项 1 分、2 分、3 分的行为锚点不够细，AI 和教师理解可能不一致。
3. AI 评分没有强制给出每项证据，教师难以判断分数是否合理。
4. 没有教师人工评分样本作为“金标准”校准。
5. 同一份对话多次评分的稳定性尚未验证。
6. 评分结果缺少模型版本、Prompt 版本、评分标准版本记录。
7. 教师无法在系统中修订 AI 评分。
8. 反馈建议可能偏泛化，教学可操作性不足。
9. 没有班级层面的高频漏问项、薄弱项分析。
10. 旧 100 分制和新 57 分制数据并存，后续统计时容易混淆。

## 二、优化目标

评分系统应满足：

1. **可靠**：同一份对话多次评分波动小。
2. **有效**：分数能反映护理病史采集能力。
3. **可解释**：每项分数能看到对应对话证据。
4. **可复核**：教师能查看、修订、确认评分。
5. **可校准**：AI 评分可与教师评分比较并持续优化。
6. **可追踪**：每次评分记录使用的模型、Prompt、评分标准版本。
7. **可教学**：反馈能指导学生下一次具体怎么问。
8. **可统计**：支持班级、病例、学生、评分项维度分析。

## 三、评分标准版本化

### 1. 将评分标准从 Prompt 中抽离

当前问题：

- `build_scoring_prompt()` 中硬编码 19 项评分标准。
- 后续修改评分标准会影响历史解释。
- 不方便教师审阅和版本管理。

建议新增目录：

```text
backend/rubrics/
├── nursing_history_v1.json
└── README.md
```

推荐 `nursing_history_v1.json` 结构：

```json
{
  "id": "nursing_history_v1",
  "name": "护理病史采集训练评分标准",
  "version": "1.0.0",
  "total_max": 57,
  "categories": [
    {
      "key": "communication",
      "name": "沟通技能",
      "max": 42,
      "items": [
        {
          "id": "comm_01",
          "name": "学生与病人打招呼并问候",
          "max": 3,
          "anchors": {
            "1": "未问候，或开场突兀直接进入问题。",
            "2": "有简单问候，但缺少自然关怀或开场不完整。",
            "3": "主动礼貌问候，语气自然，能建立初步信任。"
          },
          "positive_examples": ["您好，今天哪里不舒服？"],
          "negative_examples": ["年龄？抽烟吗？"]
        }
      ]
    }
  ]
}
```

好处：

- Prompt 可由 rubric 动态生成。
- 历史评分能保留 `rubric_version`。
- 教师可以单独审阅评分标准。
- 后续可以升级为 `v2`，不破坏旧记录。

### 2. 修改评分 Prompt 构建

位置：

- `backend/services/llm_service.py`

建议新增：

- `load_rubric(rubric_id="nursing_history_v1")`
- `build_scoring_prompt_from_rubric(case_data, conversation_text, rubric)`

Prompt 应要求 AI：

1. 按 rubric item id 逐项评分。
2. 每项给 `score`、`evidence`、`reason`。
3. 如果学生未体现该项，明确给 1 分。
4. 不允许凭整体印象给高分。

## 四、每项评分必须有证据

当前 `ScoreCard` 只展示分数和总反馈，缺少“为什么这么打分”的证据链。

### 推荐评分 JSON 结构

```json
{
  "rubric_version": "nursing_history_v1@1.0.0",
  "total_score": 50,
  "detail_scores": {
    "沟通技能": {
      "score": 37,
      "max": 42,
      "items": [
        {
          "id": "comm_01",
          "name": "学生与病人打招呼并问候",
          "score": 2,
          "evidence": "学生开场问“您好，请问哪里不舒服？”",
          "reason": "有问候，但未进一步说明身份和访谈目的。"
        }
      ]
    }
  },
  "strengths": [],
  "weaknesses": [],
  "missed_content": [],
  "suggestions": ""
}
```

建议进一步增加：

- `evidence_message_ids`：证据对应消息 ID。
- `confidence`：AI 对该项评分把握程度，可选。

### 实现步骤

1. 修改评分 Prompt，要求每项输出 `id`、`score`、`evidence`、`reason`。
2. 修改 `normalize_score_result()`，确保每项都有证据字段。
3. 修改 `ScoreCard.jsx`：

   - 展示每项评分。
   - 低分项默认展开。
   - 点击可查看证据和理由。

4. 修改 `RecordDetail.jsx`：

   - 做完整评分报告视图。
   - 让教师能查看证据链。

注意：

- 证据不要要求大段原文，防止输出过长。
- 每项证据控制在 30 到 80 字。

## 五、AI 评分稳定性测试

### 1. 建立评分回归样本集

建议新增目录：

```text
backend/evaluation/
├── samples/
│   ├── case1_short.json
│   ├── case1_medium.json
│   ├── case2_short.json
│   └── case2_medium.json
├── gold_scores/
│   └── teacher_scores.json
└── run_score_eval.py
```

样本应覆盖：

1. 很差表现。
2. 中等表现。
3. 优秀表现。
4. 只问症状、不问既往史。
5. 沟通好但采集不全。
6. 采集全但缺少共情。
7. 长对话。
8. 非常短对话。

### 2. 多次评分一致性测试

同一份对话重复评分 3 到 5 次，记录：

- 总分最大波动。
- 每项分数波动。
- 类别分数波动。

建议目标：

- 总分波动不超过 3 分。
- 单项分数大多数不波动。
- 高风险项需要人工复核。

降低波动的方法：

- 评分 `temperature=0.1` 或 `0.2`。
- Prompt 更明确。
- 每项锚点更具体。
- 评分结果缓存，已评分记录不重复评分。

### 3. 教师金标准对比

至少邀请 1 到 2 名护理教师对样本人工评分。

记录指标：

- AI 总分与教师总分差值。
- 类别分差值。
- 每项一致率。
- 低分项识别是否一致。
- 漏问内容是否一致。

建议目标：

- 总分平均绝对误差小于 5 分。
- 关键漏问项识别准确。
- 教师认为反馈建议“可用于教学”。

注意：

- 不需要追求 AI 和教师完全一致，但必须可解释、可修正。

## 六、教师人工复核与修订

### 1. 为什么需要人工复核

AI 评分适合初评，但教学场景中教师仍应有最终解释权。

建议新增能力：

- 教师查看 AI 评分。
- 教师修订某项分数。
- 教师填写修订原因。
- 系统记录修订前后差异。

### 2. 数据库建议

可新增表：

```python
class ScoreReview(Base):
    __tablename__ = "score_reviews"

    id = Column(Integer, primary_key=True)
    score_id = Column(Integer, ForeignKey("scores.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_total = Column(Float, nullable=False)
    revised_total = Column(Float, nullable=False)
    revised_detail_scores = Column(JSON, nullable=False)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, ...)
```

也可在 `scores` 表增加字段：

- `source`: `ai` / `teacher_reviewed`
- `reviewed_by`
- `reviewed_at`
- `review_comment`

推荐更清晰的做法是新增 `score_reviews`，保留原始 AI 分。

### 3. 后端接口建议

新增：

```text
GET /api/scores/{score_id}/review
POST /api/scores/{score_id}/review
PUT /api/scores/{score_id}/review
```

权限：

- 只有教师可以复核和修改。
- 学生只能看到最终展示结果，是否显示 AI 原始分由产品决定。

### 4. 前端建议

在 `RecordDetail.jsx` 或教师端记录详情加入：

- “AI 初评”标签。
- “教师已复核”标签。
- “修订评分”按钮。
- 分项评分可编辑。
- 修订原因必填。

注意：

- 学生端展示应避免让学生困惑。
- 可以显示“教师复核后分数”。

## 七、反馈质量优化

评分不只是打分，更重要是帮助学生改进。

### 当前反馈风险

- 优点可能空泛。
- 不足可能泛化。
- 建议可能像模板。
- 没有下一次训练可执行的提问建议。

### 建议反馈结构

评分结果中新增：

```json
{
  "feedback": {
    "summary": "整体表现摘要",
    "top_strengths": [
      {
        "point": "能围绕主诉追问症状特点",
        "evidence": "询问了痰的颜色、量和呼吸困难程度"
      }
    ],
    "priority_improvements": [
      {
        "point": "缺少用药依从性评估",
        "why_it_matters": "患者可能自行停药，影响病情控制",
        "next_time_question": "您最近有没有漏服或停用过平时的药？为什么？"
      }
    ],
    "practice_prompts": [
      "请用开放式问题开始询问现病史。",
      "请补充询问过敏史和家族史。"
    ]
  }
}
```

### 前端展示建议

在评分报告中分为：

1. 总体评价。
2. 表现较好。
3. 优先改进 3 项。
4. 漏问内容。
5. 下次可以这样问。

这样比单纯一段 `suggestions` 更适合教学。

## 八、教学分析能力

教师端应逐步从“看单条记录”升级为“看教学问题”。

### 1. 班级高频薄弱项

统计维度：

- 每个评分 item 平均分。
- 低于 2 分的人数比例。
- 不同病例的薄弱项。
- 高频漏问内容。

接口建议：

```text
GET /api/stats/rubric-items
GET /api/stats/missed-content
GET /api/stats/class-performance
```

展示建议：

- 排名前 5 的薄弱项。
- 高频漏问内容词云或列表。
- 班级平均分趋势。
- 每个病例平均表现。

### 2. 学生成长曲线

按学生展示：

- 总分趋势。
- 沟通技能趋势。
- 病史采集趋势。
- 低分项是否改善。
- 最近 3 次训练建议。

接口建议：

```text
GET /api/stats/students/{user_id}/growth
```

### 3. 病例质量反馈

如果某个病例中大多数学生评分异常低或 AI 评分不稳定，可能是病例设计问题。

建议统计：

- 每个病例平均分。
- 每个病例评分波动。
- 每个病例隐藏信息触发率。
- 每个病例学生完成时长。

## 九、评分结果版本兼容

当前数据库已有旧 100 分制评分和新 57 分制评分。

建议：

1. `scores` 表增加：

   - `rubric_version`
   - `score_scale`
   - `model_name`
   - `prompt_version`

2. 对旧数据标记：

   - `rubric_version = "legacy_100"`
   - `score_scale = 100`

3. 统计时默认只统计当前评分标准。
4. 如果展示旧记录，明确显示“旧版评分”。

前端：

- `ScoreCard.jsx` 保持新旧兼容。
- 统计页要避免把 100 分制和 57 分制直接混算。

## 十、评分失败与异常处理

评分可信度也包括失败时不要产生错误分数。

建议：

1. `call_llm_json()` 做 JSON 提取和容错。
2. `normalize_score_result()` 强制校验：

   - item 数量必须正确。
   - 每项分数 1 到 3。
   - 分类总分等于 item 求和。
   - total 等于分类求和。

3. 如果结构严重错误：

   - 标记 `scoring_failed`。
   - 不保存错误分数。
   - 提供重试。

4. 如果结构轻微错误：

   - 自动归一化。
   - 在日志中记录。

## 十一、建议实施顺序

### 第 1 阶段：评分标准结构化

1. 新增 `backend/rubrics/nursing_history_v1.json`。
2. 用 rubric 动态生成评分 Prompt。
3. 评分结果增加 `rubric_version`。
4. 保持前端兼容旧格式。

### 第 2 阶段：证据化评分

1. Prompt 要求每项输出 evidence 和 reason。
2. 后端归一化评分结构。
3. 前端 ScoreCard 展示每项证据。
4. 记录详情页升级为教学反馈报告。

### 第 3 阶段：稳定性与一致性测试

1. 建立样本对话集。
2. 同一对话重复评分。
3. 与教师人工评分对比。
4. 调整 Prompt 和评分锚点。

### 第 4 阶段：教师复核

1. 新增 ScoreReview 数据结构。
2. 新增复核接口。
3. 教师端支持修订分数。
4. 学生端展示复核后的反馈。

### 第 5 阶段：教学分析

1. 高频薄弱项统计。
2. 高频漏问内容统计。
3. 学生成长曲线。
4. 病例质量分析。

## 十二、验收标准

可以认为评分可信度达到阶段性可用，需要满足：

1. 评分标准有独立版本文件。
2. 每项评分有明确 1/2/3 分锚点。
3. 每项 AI 评分有证据和理由。
4. 同一对话重复评分波动可控。
5. 至少有一批教师人工评分样本对照。
6. 教师可以复核和修订 AI 评分。
7. 学生反馈包含可执行的下次提问建议。
8. 统计时不会混用旧 100 分制和新 57 分制。
9. 评分失败不会保存伪造或残缺分数。
10. 教师端能看到班级薄弱项和高频漏问内容。

## 十三、注意事项

1. 不要把 AI 评分包装成绝对客观结论，应定位为教学辅助初评。
2. 不要只看总分，护理教学更关注具体行为项。
3. 不要忽略教师复核入口。
4. 不要把旧版 100 分制和新版 57 分制混合统计。
5. 不要为了反馈好看而让 AI 编造学生没有做过的行为。
6. 不要在评分 Prompt 中泄露给患者角色使用。
7. 不要让评分建议替代临床教师的最终教学判断。

## 十四、后续评分质量问题记录

后续 AI 或开发者如果发现评分质量问题，请按以下格式追加：

```markdown
### 日期：YYYY-MM-DD

训练记录：

- record_id:

问题：

- 

AI 评分：

- 

教师判断：

- 

疑似原因：

- 评分标准不清 / Prompt 不稳 / 对话证据不足 / JSON 解析问题 / 其他

建议修改：

1. 
2. 
3. 

验证方式：

- 
```

