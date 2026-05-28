from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, TrainingRecord, Score
from schemas import DurationStats, TrendStats
from auth import get_current_user, require_teacher

router = APIRouter(prefix="/api/stats", tags=["统计"])


@router.get("/duration", response_model=DurationStats)
def get_duration_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    period: str = Query("month", description="统计周期: week / month / all"),
):
    """获取训练时长统计"""
    if current_user.role == "teacher":
        records = db.query(TrainingRecord).filter(TrainingRecord.status == "completed").all()
    else:
        records = db.query(TrainingRecord).filter(
            TrainingRecord.user_id == current_user.id,
            TrainingRecord.status == "completed",
        ).all()

    # 确定时间范围
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = None

    # 按日聚合
    daily_data = {}
    total_minutes = 0
    for r in records:
        if r.start_time and r.end_time:
            duration = (r.end_time - r.start_time).total_seconds() / 60
            date_key = r.start_time.strftime("%Y-%m-%d")
            if start_date is None or r.start_time >= start_date:
                daily_data[date_key] = daily_data.get(date_key, 0) + duration
            total_minutes += duration

    daily = [{"date": k, "minutes": round(v, 1)} for k, v in sorted(daily_data.items())]

    return DurationStats(
        daily=daily,
        total_minutes=round(total_minutes),
        total_sessions=len(records),
    )


@router.get("/trends", response_model=TrendStats)
def get_trends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    period: str = Query("month", description="统计周期: week / month / all"),
):
    """获取每日训练趋势（含次数、时长、得分）"""
    if current_user.role == "teacher":
        records = db.query(TrainingRecord).filter(TrainingRecord.status == "completed").all()
    else:
        records = db.query(TrainingRecord).filter(
            TrainingRecord.user_id == current_user.id,
            TrainingRecord.status == "completed",
        ).all()

    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = None

    # Collect record IDs for score lookup
    record_ids = [r.id for r in records]
    scores = {}
    if record_ids:
        score_rows = db.query(Score).filter(Score.record_id.in_(record_ids)).all()
        scores = {sc.record_id: sc.total_score for sc in score_rows}

    # Group by date
    daily_data = {}
    total_minutes = 0
    for r in records:
        if r.start_time:
            date_key = r.start_time.strftime("%Y-%m-%d")
            if start_date is not None and r.start_time < start_date:
                continue
            entry = daily_data.setdefault(date_key, {"sessions": 0, "minutes": 0.0, "score_sum": 0.0, "score_count": 0})
            entry["sessions"] += 1
            if r.start_time and r.end_time:
                duration = (r.end_time - r.start_time).total_seconds() / 60
                entry["minutes"] += duration
                total_minutes += duration
            if r.id in scores:
                entry["score_sum"] += scores[r.id]
                entry["score_count"] += 1

    daily = []
    all_scores = []
    for date_key in sorted(daily_data.keys()):
        d = daily_data[date_key]
        avg = round(d["score_sum"] / d["score_count"], 1) if d["score_count"] > 0 else None
        daily.append({
            "date": date_key,
            "sessions": d["sessions"],
            "minutes": round(d["minutes"], 1),
            "avg_score": avg,
        })
        if avg is not None:
            all_scores.append(avg)

    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    return TrendStats(
        daily=daily,
        total_sessions=len(records),
        total_minutes=round(total_minutes),
        avg_score=overall_avg,
    )


@router.get("/teacher-summary")
def teacher_summary(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """教师视角：每个学生的训练统计"""
    students = db.query(User).filter(User.role == "student").all()
    result = []
    for s in students:
        records = db.query(TrainingRecord).filter(
            TrainingRecord.user_id == s.id,
            TrainingRecord.status == "completed",
        ).all()
        total_sec = 0
        for r in records:
            if r.start_time and r.end_time:
                total_sec += (r.end_time - r.start_time).total_seconds()
        result.append({
            "student_id": s.id,
            "display_name": s.display_name,
            "student_code": s.student_id,
            "total_sessions": len(records),
            "total_minutes": round(total_sec / 60),
        })
    return result


@router.get("/ranking")
def student_ranking(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """教师视角：学生成绩排名（按平均分降序）"""
    students = db.query(User).filter(User.role == "student").all()
    result = []
    for s in students:
        records = db.query(TrainingRecord).filter(
            TrainingRecord.user_id == s.id,
            TrainingRecord.status == "completed",
        ).all()
        if not records:
            result.append({
                "user_id": s.id,
                "display_name": s.display_name,
                "student_id": s.student_id,
                "total_sessions": 0,
                "avg_score": None,
                "total_score": 0,
                "total_minutes": 0,
            })
            continue

        record_ids = [r.id for r in records]
        scores = db.query(Score).filter(Score.record_id.in_(record_ids)).all()
        score_map = {sc.record_id: sc.total_score for sc in scores}

        total_score = 0
        score_count = 0
        total_sec = 0
        for r in records:
            if r.id in score_map:
                total_score += score_map[r.id]
                score_count += 1
            if r.start_time and r.end_time:
                total_sec += (r.end_time - r.start_time).total_seconds()

        result.append({
            "user_id": s.id,
            "display_name": s.display_name,
            "student_id": s.student_id,
            "total_sessions": len(records),
            "avg_score": round(total_score / score_count, 1) if score_count > 0 else None,
            "total_score": round(total_score, 1),
            "total_minutes": round(total_sec / 60),
        })

    # 按平均分降序排列
    result.sort(key=lambda x: (x["avg_score"] is not None, x["avg_score"] or 0), reverse=True)

    # 添加排名
    for i, item in enumerate(result):
        item["rank"] = i + 1

    return result
