import os
import sys

# Set env vars BEFORE any app imports
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DEEPSEEK_API_KEY"] = "sk-test-placeholder"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from auth import hash_password
from models import User, Case


@pytest.fixture(scope="function")
def engine():
    """In-memory SQLite engine that persists per-test."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _set_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture(scope="function")
def db_session(engine):
    """Fresh DB session."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def client(engine, db_session):
    """FastAPI TestClient with overridden DB dependency."""
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── convenience fixtures ──

@pytest.fixture
def teacher(client, db_session):
    """Create a teacher user and return (user, token)."""
    user = User(
        username="teacher1",
        password_hash=hash_password("teacher123"),
        role="teacher",
        display_name="张老师",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    resp = client.post("/api/auth/login", json={"username": "teacher1", "password": "teacher123"})
    return user, resp.json()["access_token"]


@pytest.fixture
def student(client, db_session):
    """Create a student user and return (user, token)."""
    user = User(
        username="student1",
        password_hash=hash_password("student123"),
        role="student",
        display_name="李明",
        student_id="20240001",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    resp = client.post("/api/auth/login", json={"username": "student1", "password": "student123"})
    return user, resp.json()["access_token"]


@pytest.fixture
def test_case(db_session):
    """Create a test case and return it."""
    case = Case(
        name="测试病例-高血压",
        description="高血压病史采集练习",
        case_data={
            "name": "测试病例-高血压",
            "time_limit": 20,
            "patient_info": {"name": "王大爷", "age": 65, "gender": "男"},
            "chief_complaint": "头晕、头痛一周",
            "opening_line": "医生你好，我最近老是头晕...",
            "present_illness": "近一周反复头晕头痛",
            "past_history": "否认",
            "medication_history": "无",
            "allergy_history": "无",
            "family_history": "父亲有高血压",
            "social_history": "吸烟30年",
            "communication_style": "患者性格温和",
            "hidden_info": ["有吸烟史"],
            "required_inquiries": ["血压值", "吸烟史"],
            "scoring_criteria": {
                "沟通技能": {"max": 42, "description": "", "items": []},
                "病史采集": {"max": 15, "description": "", "items": []},
            },
        },
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case
