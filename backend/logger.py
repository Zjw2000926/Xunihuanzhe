"""结构化审计日志 — JSON 格式输出到控制台 + 文件"""
import logging
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "audit.log"


class _StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "msg": record.getMessage(),
        }
        for attr in ("request_id", "user_id", "user_role", "client_ip", "action"):
            val = getattr(record, attr, None)
            if val is not None:
                entry[attr] = val
        if record.exc_info and record.exc_info[1]:
            entry["exc"] = str(record.exc_info[1])
        return json.dumps(entry, ensure_ascii=False)


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("audit")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    fmt = _StructuredFormatter()

    # 控制台输出（开发时方便查看）
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    # 文件输出（持久化审计记录）
    file_handler = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


audit_logger = _setup_logger()


# ── 辅助函数 ──

def log_info(msg: str, **kwargs):
    extra = {k: v for k, v in kwargs.items() if v is not None}
    audit_logger.info(msg, extra=extra)


def log_warning(msg: str, **kwargs):
    extra = {k: v for k, v in kwargs.items() if v is not None}
    audit_logger.warning(msg, extra=extra)


def log_error(msg: str, **kwargs):
    extra = {k: v for k, v in kwargs.items() if v is not None}
    audit_logger.error(msg, extra=extra)
