from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, Integer as SAInteger
from database import get_db
from models import User, TrainingRecord, Score, LLMCallLog, Case as CaseModel
from schemas import UserBrief, AdminStats, UserUpdateRequest, BatchUserItem, BatchCreateResult, LLMStatsResponse, LLMCallLogItem, LLMLogListResponse
from auth import require_teacher, hash_password
from logger import log_info
import os
import shutil
from datetime import datetime, timezone
from datetime import timedelta
from config import DATABASE_URL

router = APIRouter(prefix="/api/admin", tags=["管理"])


@router.get("/users", response_model=list[UserBrief])
def list_users(current_user: User = Depends(require_teacher), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.put("/users/{user_id}", response_model=UserBrief)
def update_user(
    user_id: int,
    req: UserUpdateRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if req.display_name is not None:
        user.display_name = req.display_name
    if req.student_id is not None:
        user.student_id = req.student_id if req.student_id else None
    if req.role is not None:
        if req.role not in ("student", "teacher"):
            raise HTTPException(status_code=400, detail="角色必须为 student 或 teacher")
        user.role = req.role
    if req.password is not None and req.password:
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="密码长度不能少于6位")
        user.password_hash = hash_password(req.password)

    db.commit()
    db.refresh(user)
    log_info(f"用户更新: target_id={user_id} target_name={user.username}",
             user_id=current_user.id, user_role=current_user.role)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    record_count = db.query(func.count(TrainingRecord.id)).filter(
        TrainingRecord.user_id == user_id
    ).scalar() or 0
    if record_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"该用户有 {record_count} 条训练记录，无法删除。请先删除相关训练记录。",
        )

    target_name = user.username
    db.delete(user)
    db.commit()
    log_info(f"用户删除: target_id={user_id} target_name={target_name}",
             user_id=current_user.id, user_role=current_user.role)
    return {"message": "用户已删除"}


@router.post("/users/batch", response_model=BatchCreateResult)
def batch_create_users(
    users: list[BatchUserItem],
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    created = 0
    skipped = 0
    errors = []
    for u in users:
        if not u.username.strip() or not u.password or not u.display_name.strip():
            errors.append(f"跳过: 用户名/密码/姓名不能为空")
            skipped += 1
            continue
        if len(u.password) < 6:
            errors.append(f"跳过 {u.username}: 密码长度不能少于6位")
            skipped += 1
            continue
        if u.role not in ("student", "teacher"):
            errors.append(f"跳过 {u.username}: 角色无效")
            skipped += 1
            continue
        existing = db.query(User).filter(User.username == u.username).first()
        if existing:
            errors.append(f"跳过 {u.username}: 用户名已存在")
            skipped += 1
            continue
        db.add(User(
            username=u.username,
            password_hash=hash_password(u.password),
            display_name=u.display_name,
            role=u.role,
            student_id=u.student_id if u.student_id else None,
        ))
        created += 1
    db.commit()
    log_info(f"批量导入: created={created} skipped={skipped}",
             user_id=current_user.id, user_role=current_user.role)
    return {"created": created, "skipped": skipped, "errors": errors}


@router.get("/stats", response_model=AdminStats)
def get_stats(current_user: User = Depends(require_teacher), db: Session = Depends(get_db)):
    total_students = db.query(User).filter(User.role == "student").count()
    total_records = db.query(TrainingRecord).count()
    completed_records = db.query(TrainingRecord).filter(TrainingRecord.status == "completed").count()
    avg_score = db.query(func.avg(Score.total_score)).scalar()

    return AdminStats(
        total_students=total_students,
        total_records=total_records,
        completed_records=completed_records,
        average_score=round(float(avg_score), 1) if avg_score else None,
    )


@router.post("/backup")
def backup_database(current_user: User = Depends(require_teacher)):
    """创建数据库备份。教师权限。保留最近 10 个备份。"""
    # 从 DATABASE_URL 解析 SQLite 文件路径
    db_url = DATABASE_URL
    if db_url.startswith("sqlite:///"):
        db_path = db_url[10:]  # 去掉 "sqlite:///"
    else:
        raise HTTPException(status_code=500, detail="仅支持 SQLite 数据库备份")

    if not os.path.exists(db_path):
        raise HTTPException(status_code=500, detail=f"数据库文件不存在: {db_path}")

    backup_dir = os.path.join(os.path.dirname(db_path), "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"data_backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_name)

    shutil.copy2(db_path, backup_path)

    # 清理旧备份：仅保留最近 10 个
    existing = sorted(
        [f for f in os.listdir(backup_dir) if f.startswith("data_backup_") and f.endswith(".db")],
        reverse=True,
    )
    for old in existing[10:]:
        os.remove(os.path.join(backup_dir, old))

    log_info(f"数据库备份: {backup_name} ({os.path.getsize(backup_path)} bytes)",
             user_id=current_user.id, user_role=current_user.role)
    return {"message": "备份完成", "filename": backup_name}


# ── LLM 调用监控 ──

def _build_llm_stats(db: Session, since: datetime):
    """查询指定时间范围内的 LLM 调用统计数据"""
    base = db.query(LLMCallLog).filter(LLMCallLog.created_at >= since, LLMCallLog.created_at < datetime.now(timezone.utc))
    total = base.count()
    if total == 0:
        return {"count": 0, "success_rate": 0, "avg_latency_ms": 0, "total_cost": 0}
    success_count = base.filter(LLMCallLog.status == "success").count()
    avg_latency = db.query(func.avg(LLMCallLog.latency_ms)).filter(
        LLMCallLog.created_at >= since, LLMCallLog.created_at < datetime.now(timezone.utc)
    ).scalar() or 0
    total_cost = db.query(func.sum(LLMCallLog.estimated_cost)).filter(
        LLMCallLog.created_at >= since, LLMCallLog.created_at < datetime.now(timezone.utc)
    ).scalar() or 0
    return {
        "count": total,
        "success_rate": round(success_count / total * 100, 1),
        "avg_latency_ms": round(avg_latency, 0),
        "total_cost": round(total_cost, 4),
    }


@router.get("/llm-stats", response_model=LLMStatsResponse)
def get_llm_stats(current_user: User = Depends(require_teacher), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    today_stats = _build_llm_stats(db, today_start)
    week_stats = _build_llm_stats(db, week_start)

    # by_purpose
    rows = db.query(
        LLMCallLog.purpose,
        func.count().label("count"),
        func.avg(LLMCallLog.latency_ms).label("avg_latency"),
        func.sum(func.cast(LLMCallLog.status != "success", type_=SAInteger)).label("error_count"),
    ).filter(LLMCallLog.created_at >= week_start, LLMCallLog.created_at < now).group_by(LLMCallLog.purpose).all()
    by_purpose = [
        {"purpose": r[0], "count": r[1], "avg_latency_ms": round(r[2] or 0, 0), "error_count": r[3]}
        for r in rows
    ]

    # daily: 最近30天
    daily_rows = db.query(
        func.date(LLMCallLog.created_at).label("date"),
        func.count().label("count"),
        func.sum(func.cast(LLMCallLog.status == "success", type_=SAInteger)).label("success_count"),
        func.sum(func.cast(LLMCallLog.status != "success", type_=SAInteger)).label("fail_count"),
        func.sum(LLMCallLog.estimated_cost).label("total_cost"),
    ).filter(LLMCallLog.created_at >= month_start, LLMCallLog.created_at < now).group_by("date").order_by("date").all()
    daily = [
        {"date": str(r[0]), "count": r[1], "success_count": r[2] or 0, "fail_count": r[3] or 0, "total_cost": round(r[4] or 0, 4)}
        for r in daily_rows
    ]

    return LLMStatsResponse(
        today=today_stats,
        week=week_stats,
        by_purpose=by_purpose,
        daily=daily,
    )


@router.get("/llm-logs", response_model=LLMLogListResponse)
def get_llm_logs(
    page: int = 1,
    page_size: int = 20,
    purpose: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    aggregate_patient_chat: bool = True,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """返回 LLM 调用日志。aggregate_patient_chat=true 时将同一训练下的 patient_chat 聚合为一条训练级记录。"""
    all_items = []

    # 是否对 patient_chat 做训练级聚合
    do_agg = aggregate_patient_chat and (purpose is None or purpose == "patient_chat")
    # 是否需要返回原始（非聚合）日志
    need_raw = (not aggregate_patient_chat) or (purpose is not None and purpose != "patient_chat")

    if do_agg:
        # ── 聚合 patient_chat，按 record_id 分组 ──
        agg_q = db.query(
            LLMCallLog.record_id.label("record_id"),
            func.max(LLMCallLog.id).label("id"),
            func.max(LLMCallLog.user_id).label("user_id"),
            func.max(LLMCallLog.case_id).label("case_id"),
            func.count().label("call_count"),
            func.avg(LLMCallLog.latency_ms).label("latency_ms"),
            func.sum(LLMCallLog.prompt_tokens).label("prompt_tokens"),
            func.sum(LLMCallLog.completion_tokens).label("completion_tokens"),
            func.sum(LLMCallLog.total_tokens).label("total_tokens"),
            func.max(LLMCallLog.token_estimated).label("token_estimated"),
            func.sum(LLMCallLog.estimated_cost).label("estimated_cost"),
            func.sum(func.cast(LLMCallLog.status != "success", type_=SAInteger)).label("error_count"),
            func.min(LLMCallLog.created_at).label("first_called_at"),
            func.max(LLMCallLog.created_at).label("created_at"),
            User.display_name.label("student_name"),
            CaseModel.name.label("case_name"),
        ).join(TrainingRecord, LLMCallLog.record_id == TrainingRecord.id, isouter=True) \
         .join(User, TrainingRecord.user_id == User.id, isouter=True) \
         .join(CaseModel, TrainingRecord.case_id == CaseModel.id, isouter=True) \
         .filter(
            LLMCallLog.purpose == "patient_chat",
            LLMCallLog.record_id.isnot(None),
        )

        # 日期筛选作用于原始调用
        if date_from:
            agg_q = agg_q.filter(LLMCallLog.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            agg_q = agg_q.filter(LLMCallLog.created_at < datetime.fromisoformat(date_to))

        agg_q = agg_q.group_by(LLMCallLog.record_id)

        # 状态筛选作用于聚合结果
        if status == "success":
            agg_q = agg_q.having(func.sum(func.cast(LLMCallLog.status != "success", type_=SAInteger)) == 0)
        elif status == "failed":
            agg_q = agg_q.having(func.sum(func.cast(LLMCallLog.status != "success", type_=SAInteger)) > 0)

        agg_rows = agg_q.all()

        for r in agg_rows:
            avg_lat = round(r.latency_ms) if r.latency_ms else None
            all_items.append({
                "id": r.id,
                "user_id": r.user_id,
                "record_id": r.record_id,
                "case_id": r.case_id,
                "purpose": "patient_chat",
                "provider": "deepseek",
                "model": "",
                "temperature": None,
                "max_tokens": None,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "token_estimated": 1 if r.token_estimated else 0,
                "estimated_cost": round(r.estimated_cost, 6) if r.estimated_cost else None,
                "cost_currency": None,
                "latency_ms": avg_lat,
                "status": "success" if (r.error_count or 0) == 0 else "failed",
                "error_type": None,
                "error_message": None,
                "request_chars": None,
                "response_chars": None,
                "created_at": r.created_at,
                "call_count": r.call_count,
                "avg_latency_ms": avg_lat,
                "error_count": r.error_count or 0,
                "first_called_at": r.first_called_at,
                "last_called_at": r.created_at,
                "student_name": r.student_name,
                "case_name": r.case_name,
                "is_aggregated": True,
            })

    if need_raw:
        # ── 非 patient_chat 原始日志 ──
        q = db.query(LLMCallLog)
        if aggregate_patient_chat and purpose is None:
            # 聚合模式且未指定用途：排除已聚合的 patient_chat，只取 scoring/qa/summary/other
            q = q.filter(LLMCallLog.purpose != "patient_chat")
        elif purpose:
            q = q.filter(LLMCallLog.purpose == purpose)
        if status:
            q = q.filter(LLMCallLog.status == status)
        if date_from:
            q = q.filter(LLMCallLog.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            q = q.filter(LLMCallLog.created_at < datetime.fromisoformat(date_to))
        raw_logs = q.order_by(LLMCallLog.created_at.desc()).all()
        all_items.extend(raw_logs)

    # 按 created_at 降序排列
    def _get_ts(item):
        if isinstance(item, dict):
            return item["created_at"]
        return item.created_at

    all_items.sort(key=_get_ts, reverse=True)

    # 分页
    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    paged = all_items[start:end]

    return LLMLogListResponse(
        items=paged,
        total=total,
        page=page,
        page_size=page_size,
    )
