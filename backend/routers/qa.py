from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import QARequest, QAResponse
from auth import get_current_user
from services.llm_service import call_llm
from rate_limiter import check_qa_limit

router = APIRouter(prefix="/api/qa", tags=["通用问答"])

NURSING_SYSTEM_PROMPT = """你是一位经验丰富的护理教育导师，专门帮助护理学生提升专业能力。

## 你的职责
1. 解答护理病史采集的系统方法和技巧（如护理问诊流程、开放式提问策略、共情沟通技术）
2. 讲解护理评估框架（Gordon功能性健康型态、生物-心理-社会评估模式等）
3. 帮助理解护理诊断与医疗诊断的区别，指导护理问题的识别
4. 解释护理操作规范、临床护理要点和患者健康教育方法
5. 指导如何评估患者的自我护理能力、健康信念和家庭支持

## 回答要求
1. 专业准确但语言通俗易懂，适合护理学生理解
2. 回答尽量简洁，控制在200字以内
3. 如果不确定，诚实说明，绝不编造医学或护理信息
4. 可适当结合临床案例说明，帮助理论联系实践
5. 回答末尾可提出引导性问题，激发学生进一步思考
6. 始终保持鼓励和支持的态度

## 限制
- 只回答护理专业相关问题（护理评估、护理操作、健康教育、护理沟通等）
- 如学生问非护理专业问题，礼貌引导回护理学习主题
- 不提供处方药建议或医疗诊断建议（非护理执业范畴）
- 不替代临床带教老师的实操指导"""


@router.post("/ask", response_model=QAResponse)
async def ask_question(req: QARequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    check_qa_limit(current_user.id)

    messages = [
        {"role": "system", "content": NURSING_SYSTEM_PROMPT},
        {"role": "user", "content": req.question},
    ]

    try:
        answer = await call_llm(messages, temperature=0.7, max_tokens=1024,
                                    purpose="qa", user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI调用失败: {str(e)}")

    return QAResponse(answer=answer)
