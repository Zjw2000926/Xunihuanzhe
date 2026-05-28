from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime as SAType, ForeignKey, JSON, Index
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from database import Base


class UtcDateTime(TypeDecorator):
    """确保 SQLite 读写时 UTC 时区信息不丢失，Pydantic 序列化时带 Z/+00:00 后缀"""
    impl = SAType
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return value.replace(tzinfo=timezone.utc)
        return value


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(10), nullable=False, default="student")  # student / teacher
    display_name = Column(String(50), nullable=False)
    student_id = Column(String(30), nullable=True)
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    training_records = relationship("TrainingRecord", back_populates="user")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    case_data = Column(JSON, nullable=False)  # 完整病例数据
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))


class TrainingRecord(Base):
    __tablename__ = "training_records"
    __table_args__ = (
        Index("ix_tr_user_status", "user_id", "status"),
        Index("ix_tr_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    status = Column(String(20), nullable=False, default="in_progress")  # in_progress / completed
    scoring_status = Column(String(20), nullable=True)  # null / pending / processing / completed / failed
    scoring_error = Column(Text, nullable=True)  # 评分失败时的错误信息
    start_time = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))
    end_time = Column(UtcDateTime, nullable=True)

    user = relationship("User", back_populates="training_records")
    case = relationship("Case")
    messages = relationship("Message", back_populates="record", order_by="Message.created_at")
    score = relationship("Score", back_populates="record", uselist=False)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_msg_record_created", "record_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("training_records.id"), nullable=False)
    role = Column(String(10), nullable=False)  # student / patient
    content = Column(Text, nullable=False)
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    record = relationship("TrainingRecord", back_populates="messages")


class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("training_records.id"), unique=True, nullable=False)
    total_score = Column(Float, nullable=False)
    detail_scores = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    missed_content = Column(JSON, nullable=True)
    suggestions = Column(Text, nullable=True)
    # 评分标准版本追踪
    rubric_version = Column(String(40), nullable=True)
    model_name = Column(String(80), nullable=True)
    prompt_version = Column(Integer, nullable=True, default=1)
    score_scale = Column(Integer, nullable=True, default=100)
    # 教师复核
    review_status = Column(String(20), nullable=True)  # null / reviewed
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(UtcDateTime, nullable=True)
    review_detail_scores = Column(JSON, nullable=True)
    review_comment = Column(Text, nullable=True)
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    record = relationship("TrainingRecord", back_populates="score")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("training_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class LLMCallLog(Base):
    """记录每次 LLM 调用的元数据，用于成本监控和稳定性分析"""
    __tablename__ = "llm_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("training_records.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    purpose = Column(String(40), nullable=False, index=True)  # patient_chat / scoring / qa / summary / other
    provider = Column(String(40), nullable=False, default="deepseek")
    model = Column(String(80), nullable=False)
    temperature = Column(Float, nullable=True)
    max_tokens = Column(Integer, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    token_estimated = Column(Integer, nullable=False, default=1)  # 0=真实usage, 1=估算
    estimated_cost = Column(Float, nullable=True)
    cost_currency = Column(String(10), nullable=True, default="CNY")
    latency_ms = Column(Integer, nullable=True, index=True)
    status = Column(String(20), nullable=False, index=True)  # success / failed / timeout / rate_limited / auth_error
    error_type = Column(String(80), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    request_chars = Column(Integer, nullable=True)
    response_chars = Column(Integer, nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(UtcDateTime, default=lambda: datetime.now(timezone.utc), index=True)
