from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str = Field(min_length=6)
    role: str = "student"
    display_name: str
    student_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str
    user_id: int


class CaseBrief(BaseModel):
    id: int
    name: str
    difficulty: int = 1
    description: Optional[str]
    patient_summary: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class CaseDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    case_data: dict

    model_config = ConfigDict(from_attributes=True)


class TrainingStartRequest(BaseModel):
    case_id: int


class TrainingStartResponse(BaseModel):
    record_id: int
    greeting: str
    case_name: str = ""


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    role: str
    content: str


class MessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoreItem(BaseModel):
    id: int
    total_score: float
    detail_scores: Optional[dict]
    strengths: Optional[list]
    weaknesses: Optional[list]
    missed_content: Optional[list]
    suggestions: Optional[str]
    rubric_version: Optional[str] = None
    model_name: Optional[str] = None
    prompt_version: Optional[int] = None
    score_scale: Optional[int] = None
    review_status: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteItem(BaseModel):
    id: int
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteCreateRequest(BaseModel):
    content: str


class TrainingRecordBrief(BaseModel):
    id: int
    case_id: int
    case_name: str
    user_display_name: str
    user_student_id: Optional[str]
    status: str
    scoring_status: Optional[str] = None
    scoring_error: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime]
    score_total: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class TrainingRecordDetail(BaseModel):
    id: int
    case_id: int
    case_name: str
    user_display_name: str
    status: str
    scoring_status: Optional[str] = None
    scoring_error: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime]
    time_limit: int = 20
    remaining_seconds: Optional[int] = None
    messages: List[MessageItem]
    score: Optional[ScoreItem] = None
    notes: List[NoteItem] = []
    required_inquiries: Optional[list] = None

    model_config = ConfigDict(from_attributes=True)


class UserBrief(BaseModel):
    id: int
    username: str
    role: str
    display_name: str
    student_id: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminStats(BaseModel):
    total_students: int
    total_records: int
    completed_records: int
    average_score: Optional[float]
    avg_duration_min: Optional[float] = None
    today_records: int = 0


class QARequest(BaseModel):
    question: str


class QAResponse(BaseModel):
    answer: str


class DurationStats(BaseModel):
    daily: list  # [{date: "2026-05-20", minutes: 45}, ...]
    total_minutes: int
    total_sessions: int


class TrendStats(BaseModel):
    daily: list  # [{date, sessions, minutes, avg_score}, ...]
    total_sessions: int
    total_minutes: int
    avg_score: Optional[float] = None


# ── 病例管理 ──

class CaseCreateRequest(BaseModel):
    case_data: dict


class CaseUpdateRequest(BaseModel):
    case_data: dict


class CaseManageItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    patient_name: str = ""
    patient_age: Optional[int] = None
    patient_gender: str = ""
    chief_complaint: str = ""
    time_limit: int = 20
    difficulty: int = 1
    created_at: datetime
    training_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    student_id: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


# ── 批量导入 ──

class BatchUserItem(BaseModel):
    username: str
    password: str = Field(min_length=6)
    display_name: str
    role: str = "student"
    student_id: Optional[str] = None


class BatchCreateResult(BaseModel):
    created: int
    skipped: int
    errors: list


# ── LLM 调用监控 ──

class LLMCallLogItem(BaseModel):
    id: int
    user_id: Optional[int] = None
    record_id: Optional[int] = None
    case_id: Optional[int] = None
    purpose: str
    provider: str = "deepseek"
    model: str = ""
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    token_estimated: int = 0
    estimated_cost: Optional[float] = None
    cost_currency: Optional[str] = None
    latency_ms: Optional[int] = None
    status: str = "success"
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    request_chars: Optional[int] = None
    response_chars: Optional[int] = None
    created_at: datetime
    # 聚合字段（v1.17）
    call_count: int = 1
    avg_latency_ms: Optional[int] = None
    error_count: int = 0
    first_called_at: Optional[datetime] = None
    last_called_at: Optional[datetime] = None
    student_name: Optional[str] = None
    case_name: Optional[str] = None
    is_aggregated: bool = False

    model_config = ConfigDict(from_attributes=True)


class LLMStatsResponse(BaseModel):
    today: dict  # {count, success_rate, avg_latency_ms, total_cost}
    week: dict   # same structure
    by_purpose: list  # [{purpose, count, avg_latency_ms, error_count}]
    daily: list  # [{date, count, success_count, fail_count, total_cost}] 最近30天


class LLMLogListResponse(BaseModel):
    items: List[LLMCallLogItem]
    total: int
    page: int
    page_size: int


# ── 教师复核 ──

class ScoreReviewRequest(BaseModel):
    detail_scores: Optional[dict] = None
    comment: Optional[str] = None


class ScoreReviewResponse(BaseModel):
    score_id: int
    review_status: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    original_detail_scores: Optional[dict] = None
    review_detail_scores: Optional[dict] = None
    review_comment: Optional[str] = None
