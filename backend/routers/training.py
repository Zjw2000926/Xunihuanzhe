import asyncio
import threading
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from database import get_db, SessionLocal
from models import User, Case, TrainingRecord, Message, Score, Note
from schemas import (
    TrainingStartRequest, TrainingStartResponse, TrainingRecordBrief,
    TrainingRecordDetail, ScoreReviewRequest, ScoreReviewResponse,
)
from auth import get_current_user, require_teacher
from logger import log_info, audit_logger

router = APIRouter(prefix="/api/training", tags=["训练"])

# 评分并发锁：防止同一 record 触发多次评分
_scoring_pending: set[int] = set()
_scoring_pending_lock = threading.Lock()


def _try_acquire_scoring(record_id: int) -> bool:
    """尝试标记评分进行中，失败表示已有任务在处理"""
    with _scoring_pending_lock:
        if record_id in _scoring_pending:
            return False
        _scoring_pending.add(record_id)
        return True


def _release_scoring(record_id: int):
    """评分任务完成或失败后释放"""
    with _scoring_pending_lock:
        _scoring_pending.discard(record_id)


@router.post("/start", response_model=TrainingStartResponse)
def start_training(req: TrainingStartRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="仅学生可以开始训练")

    case = db.query(Case).filter(Case.id == req.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="病例不存在")

    record = TrainingRecord(
        user_id=current_user.id,
        case_id=case.id,
        status="in_progress",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # 从病例中获取患者姓名用于开场问候
    case_data = case.case_data or {}
    patient_info = case_data.get("patient_info", {})
    patient_name = patient_info.get("name", "患者")
    greeting = f"你好，我是{patient_name}。{case_data.get('opening_line', '我今天感觉不太舒服，所以来看看。')}"

    # 保存欢迎消息
    greeting_msg = Message(record_id=record.id, role="patient", content=greeting)
    db.add(greeting_msg)
    db.commit()

    return TrainingStartResponse(record_id=record.id, greeting=greeting)


def _run_scoring_background(record_id: int, case_data: dict):
    """后台线程中执行评分。使用 asyncio.run() 新建事件循环，因为:
    - BackgroundTasks 对 sync 函数会在线程池执行
    - 评分涉及 LLM 调用（async），需事件循环
    - 若直接设为 async 函数则会阻塞主事件循环（评分耗时 30-120s）
    """
    SCORING_GLOBAL_TIMEOUT = 300  # 5 分钟全局超时

    async def _do():
        db = SessionLocal()
        try:
            record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
            if not record:
                return
            record.scoring_status = "processing"
            db.commit()

            from services.scoring import evaluate_training
            await asyncio.wait_for(
                evaluate_training(record_id, case_data, db),
                timeout=SCORING_GLOBAL_TIMEOUT,
            )

            record.scoring_status = "completed"
            record.scoring_error = None
            db.commit()
            audit_logger.info("评分完成", extra={"record_id": record_id, "scoring_status": "completed"})
        except asyncio.TimeoutError:
            try:
                record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
                if record:
                    record.scoring_status = "failed"
                    record.scoring_error = "评分超时（超过5分钟）"
                    db.commit()
            except Exception:
                pass
            audit_logger.error("评分超时", extra={"record_id": record_id})
        except Exception as e:
            try:
                record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
                if record:
                    record.scoring_status = "failed"
                    record.scoring_error = str(e)[:500]
                    db.commit()
            except Exception:
                pass
            audit_logger.error("评分失败", extra={"record_id": record_id, "error": str(e)[:200]})
        finally:
            db.close()

    try:
        asyncio.run(_do())
    finally:
        _release_scoring(record_id)


@router.post("/{record_id}/end")
def end_training(
    record_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="训练记录不存在")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能结束自己的训练")
    if record.status == "completed":
        raise HTTPException(status_code=400, detail="训练已结束")
    if record.scoring_status in ("pending", "processing"):
        raise HTTPException(status_code=400, detail="评分正在进行中，请稍后查看")

    if not _try_acquire_scoring(record_id):
        raise HTTPException(status_code=409, detail="评分已被其他请求触发，请刷新查看")

    case = db.query(Case).filter(Case.id == record.case_id).first()

    # 立即标记完成 + 评分待处理，响应不再阻塞在 LLM 调用上
    record.status = "completed"
    record.end_time = datetime.now(timezone.utc)
    record.scoring_status = "pending"
    db.commit()

    # 清理隐藏主题缓存
    from routers.chat import _cleanup_disclosed_topics
    _cleanup_disclosed_topics(record_id)

    background_tasks.add_task(_run_scoring_background, record_id, case.case_data if case else {})

    return {
        "message": "训练已结束，评分正在后台生成中",
        "record_id": record_id,
        "scoring_status": "pending",
    }


@router.post("/{record_id}/retry-scoring")
def retry_scoring(
    record_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """重新触发失败的评分（学生本人或教师可操作）"""
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="训练记录不存在")
    if current_user.role != "teacher" and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此记录")
    if record.status != "completed":
        raise HTTPException(status_code=400, detail="训练尚未结束")
    if record.scoring_status == "pending":
        raise HTTPException(status_code=400, detail="评分正在进行中，请稍后重试")
    if record.scoring_status == "processing":
        # 检查是否超时（超过 5 分钟仍 processing，视为僵尸状态）
        if record.end_time and (datetime.now(timezone.utc) - record.end_time).total_seconds() > 300:
            record.scoring_status = "failed"
            db.commit()
        else:
            raise HTTPException(status_code=400, detail="评分正在进行中，请稍后重试")

    if not _try_acquire_scoring(record_id):
        raise HTTPException(status_code=409, detail="评分已被其他请求触发，请稍后重试")

    case = db.query(Case).filter(Case.id == record.case_id).first()
    record.scoring_status = "pending"
    record.scoring_error = None
    db.commit()

    background_tasks.add_task(_run_scoring_background, record_id, case.case_data if case else {})

    return {"message": "评分已重新触发", "record_id": record_id, "scoring_status": "pending"}


@router.get("/records", response_model=list[TrainingRecordBrief])
def get_records(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    student_name: str | None = Query(None, description="按学生姓名模糊搜索"),
    case_id: int | None = Query(None, description="按病例ID筛选"),
    status: str | None = Query(None, description="按状态筛选(in_progress/completed)"),
    date_from: str | None = Query(None, description="开始日期 ISO 格式 (含)"),
    date_to: str | None = Query(None, description="结束日期 ISO 格式 (含)"),
):
    """获取训练记录列表。学生只看自己的，教师看全部并支持多维过滤。"""
    base = db.query(TrainingRecord)

    if current_user.role != "teacher":
        base = base.filter(TrainingRecord.user_id == current_user.id)
    else:
        if student_name:
            base = base.filter(
                TrainingRecord.user.has(User.display_name.ilike(f"%{student_name}%"))
            )
        if case_id is not None:
            base = base.filter(TrainingRecord.case_id == case_id)
        if status:
            base = base.filter(TrainingRecord.status == status)
        if date_from:
            try:
                df = datetime.fromisoformat(date_from)
                if df.tzinfo is None:
                    df = df.replace(tzinfo=timezone.utc)
                base = base.filter(TrainingRecord.start_time >= df)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效日期格式: {date_from}")
        if date_to:
            try:
                dt = datetime.fromisoformat(date_to)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                base = base.filter(TrainingRecord.start_time <= dt)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效日期格式: {date_to}")

    total = base.count()
    query = base.options(
        joinedload(TrainingRecord.case),
        joinedload(TrainingRecord.user),
        joinedload(TrainingRecord.score),
    )
    records = query.order_by(TrainingRecord.start_time.desc()).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Has-More"] = str(offset + limit < total).lower()

    result = []
    for r in records:
        result.append(TrainingRecordBrief(
            id=r.id,
            case_id=r.case_id,
            case_name=r.case.name if r.case else "",
            user_display_name=r.user.display_name if r.user else "",
            user_student_id=r.user.student_id if r.user else None,
            status=r.status,
            start_time=r.start_time,
            end_time=r.end_time,
            score_total=r.score.total_score if r.score else None,
        ))
    return result


@router.get("/records/{record_id}", response_model=TrainingRecordDetail)
def get_record_detail(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    # 权限检查：学生只能看自己的，教师看全部
    if current_user.role != "teacher" and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此记录")

    case = db.query(Case).filter(Case.id == record.case_id).first()
    user = db.query(User).filter(User.id == record.user_id).first()
    score = db.query(Score).filter(Score.record_id == record_id).first()
    note_records = db.query(Note).filter(Note.record_id == record_id).order_by(Note.updated_at.desc()).all()

    case_data = case.case_data or {} if case else {}
    time_limit = case_data.get("time_limit", 20)
    remaining_seconds = None
    if record.status == "in_progress" and record.start_time:
        elapsed = (datetime.now(timezone.utc) - record.start_time).total_seconds()
        remaining_seconds = max(0, int(time_limit * 60 - elapsed))
    return TrainingRecordDetail(
        id=record.id,
        case_id=record.case_id,
        case_name=case.name if case else "",
        user_display_name=user.display_name if user else "",
        status=record.status,
        scoring_status=record.scoring_status,
        scoring_error=record.scoring_error,
        start_time=record.start_time,
        end_time=record.end_time,
        time_limit=time_limit,
        remaining_seconds=remaining_seconds,
        messages=record.messages,
        score=score,
        notes=note_records,
        required_inquiries=case_data.get("required_inquiries", []),
    )


@router.delete("/records/{record_id}")
def delete_record(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """删除训练记录。教师可删全部，学生仅可删自己的。"""
    record = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="训练记录不存在")

    # 权限检查
    if current_user.role != "teacher" and record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此记录")

    # 级联删除关联数据
    db.query(Message).filter(Message.record_id == record_id).delete()
    db.query(Score).filter(Score.record_id == record_id).delete()
    db.query(Note).filter(Note.record_id == record_id).delete()
    db.delete(record)
    db.commit()

    log_info(f"训练记录删除: record_id={record_id} case_id={record.case_id} owner_id={record.user_id}",
             user_id=current_user.id, user_role=current_user.role)
    return {"message": "训练记录已删除"}


# ── 教师复核 ──

@router.get("/records/{record_id}/review", response_model=ScoreReviewResponse)
def get_score_review(
    record_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    score = db.query(Score).filter(Score.record_id == record_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="该记录暂无评分")

    reviewer_name = None
    if score.reviewed_by:
        reviewer = db.query(User).filter(User.id == score.reviewed_by).first()
        reviewer_name = reviewer.display_name if reviewer else None

    return ScoreReviewResponse(
        score_id=score.id,
        review_status=score.review_status or "pending",
        reviewed_by_name=reviewer_name,
        reviewed_at=score.reviewed_at,
        original_detail_scores=score.detail_scores,
        review_detail_scores=score.review_detail_scores,
        review_comment=score.review_comment,
    )


@router.post("/records/{record_id}/review", response_model=ScoreReviewResponse)
def submit_score_review(
    record_id: int,
    req: ScoreReviewRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    score = db.query(Score).filter(Score.record_id == record_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="该记录暂无评分")

    if req.detail_scores is not None:
        score.review_detail_scores = req.detail_scores
        # 重算总分：累加所有维度 score
        new_total = 0.0
        for dim_data in req.detail_scores.values():
            if isinstance(dim_data, dict):
                new_total += dim_data.get("score", 0)
        score.total_score = round(new_total, 1)
    if req.comment is not None:
        score.review_comment = req.comment

    score.review_status = "reviewed"
    score.reviewed_by = current_user.id
    score.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(score)

    log_info(f"评分复核: score_id={score.id} reviewer_id={current_user.id}",
             user_id=current_user.id, user_role=current_user.role)

    reviewer_name = current_user.display_name
    return ScoreReviewResponse(
        score_id=score.id,
        review_status=score.review_status or "reviewed",
        reviewed_by_name=reviewer_name,
        reviewed_at=score.reviewed_at,
        original_detail_scores=score.detail_scores,
        review_detail_scores=score.review_detail_scores,
        review_comment=score.review_comment,
    )
