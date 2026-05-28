import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool

from config import DATABASE_URL

logger = logging.getLogger("alembic")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=15,
    pool_pre_ping=True,
    pool_recycle=3600,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """为 SQLite 连接启用 WAL 模式并优化同步策略"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import models  # noqa: F401

    # 尝试使用 Alembic 迁移；若未配置则回退到 create_all
    try:
        from alembic.config import Config
        from alembic import command
        import os
        alembic_ini = os.path.join(os.path.dirname(__file__), "alembic.ini")
        if os.path.isfile(alembic_ini):
            alembic_cfg = Config(alembic_ini)
            command.upgrade(alembic_cfg, "head")
            # 确保复合索引存在（Alembic 可能未捕获 create_all 中添加的手动索引）
            _ensure_indexes()
            return
    except Exception as e:
        logger.warning("Alembic 迁移失败，回退到 create_all: %s", e)

    Base.metadata.create_all(bind=engine)
    _ensure_indexes()


def _ensure_indexes():
    """确保复合索引存在"""
    with engine.connect() as conn:
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_msg_record_created ON messages(record_id, created_at)"
        )
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_tr_user_status ON training_records(user_id, status)"
        )
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_tr_status ON training_records(status)"
        )
        conn.commit()
