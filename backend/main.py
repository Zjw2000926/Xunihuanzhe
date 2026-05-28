import os
import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import init_db, engine, get_db
from routers import auth, cases, training, chat, export, admin, notes, qa, stats
from logger import audit_logger

_MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str(10 * 1024 * 1024)))  # 默认 10MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_data()
    # 限流器后台清理（每 10 分钟）
    from rate_limiter import _limiter as rate_limiter
    async def _cleanup_loop():
        while True:
            await asyncio.sleep(600)
            rate_limiter.cleanup()
    cleanup_task = asyncio.create_task(_cleanup_loop())
    yield
    cleanup_task.cancel()
    # 关闭共享 httpx 客户端
    from services.llm_service import _shared_client
    if _shared_client:
        await _shared_client.aclose()
    engine.dispose()


app = FastAPI(title="虚拟患者训练系统", version="1.0.0", lifespan=lifespan)

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _try_extract_user(request: Request) -> tuple:
    """尝试从 Authorization 头解析用户信息，用于日志记录。解析失败返回 None。"""
    from jose import jwt as _jwt
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None
    try:
        from config import SECRET_KEY, ALGORITHM
        payload = _jwt.decode(auth_header[7:], SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("user_id"), payload.get("role")
    except Exception:
        return None, None


@app.middleware("http")
async def request_id_and_audit_middleware(request: Request, call_next):
    """为每个请求分配唯一 ID，记录请求摘要"""
    rid = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    request.state.request_id = rid
    t0 = time.time()

    response = await call_next(request)

    duration_ms = round((time.time() - t0) * 1000)
    user_id, user_role = _try_extract_user(request)

    audit_logger.info(
        "%s %s → %s (%.0fms)",
        request.method, request.url.path, response.status_code, duration_ms,
        extra={
            "request_id": rid,
            "user_id": user_id,
            "user_role": user_role,
            "client_ip": _get_client_ip(request),
        },
    )
    response.headers["X-Request-ID"] = rid
    return response


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """拒绝超大请求体，防止内存耗尽"""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > _MAX_REQUEST_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": f"请求体过大，最大允许 {_MAX_REQUEST_BYTES // (1024*1024)}MB"},
        )
    return await call_next(request)

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(training.router)
app.include_router(chat.router)
app.include_router(export.router)
app.include_router(admin.router)
app.include_router(notes.router)
app.include_router(qa.router)
app.include_router(stats.router)


@app.get("/api")
def root():
    return {"message": "虚拟患者训练系统 API", "version": "1.0.0"}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """健康检查：验证数据库连接和服务状态"""
    from config import APP_VERSION
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": APP_VERSION,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"数据库连接失败: {str(e)}")


# 生产模式：服务前端构建产物
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


def _seed_data():
    """初始化种子数据：管理员账号和病例"""
    from database import SessionLocal
    from models import User, Case
    from auth import hash_password
    import json
    import os

    db = SessionLocal()
    try:
        # 检查是否已初始化
        if db.query(User).count() > 0:
            return

        # 创建默认教师账号
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="teacher",
            display_name="管理员",
            student_id=None,
        )
        db.add(admin)

        # 创建测试学生账号
        for i in range(1, 6):
            student = User(
                username=f"student{i}",
                password_hash=hash_password("123456"),
                role="student",
                display_name=f"学生{i}",
                student_id=f"202400{i:02d}",
            )
            db.add(student)

        # 导入病例数据
        cases_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cases")
        for case_file in sorted(os.listdir(cases_dir)):
            if case_file.endswith(".json"):
                with open(os.path.join(cases_dir, case_file), "r", encoding="utf-8") as f:
                    case_data = json.load(f)
                case = Case(
                    name=case_data.get("name", case_file),
                    description=case_data.get("description", ""),
                    case_data=case_data,
                )
                db.add(case)

        db.commit()
        print("种子数据初始化完成")
    finally:
        db.close()
