"""内存滑动窗口速率限制器，单机部署无需 Redis。"""
import time
import threading
from collections import defaultdict
from fastapi import Request, HTTPException, status


class RateLimiter:
    """线程安全的内存限流器"""

    def __init__(self):
        self._lock = threading.Lock()
        self._store: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._store[key]
            # 惰性清理过期记录（bucket 通常只有几个元素）
            self._store[key] = [t for t in bucket if t > cutoff]
            if len(self._store[key]) >= max_requests:
                return False
            self._store[key].append(now)
            return True

    def reset_key(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def cleanup(self, max_age_seconds: int = 600):
        """清理过期 key，防止内存泄漏。后台定时调用。"""
        now = time.time()
        cutoff = now - max_age_seconds
        with self._lock:
            stale = [k for k, v in self._store.items() if not any(t > cutoff for t in v)]
            for k in stale:
                del self._store[k]


_limiter = RateLimiter()


def _get_client_ip(request: Request) -> str:
    """获取真实客户端 IP（支持反向代理转发头）"""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


# ── 各接口限流依赖 ──


async def login_rate_limit(request: Request):
    """登录限流：同一 IP 5 分钟内最多 10 次失败"""
    key = f"login:{_get_client_ip(request)}"
    if not _limiter.is_allowed(key, max_requests=10, window_seconds=300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="登录尝试过于频繁，请 15 分钟后再试",
        )


async def register_rate_limit(request: Request):
    """注册限流：同一 IP 每分钟最多 5 次"""
    key = f"register:{_get_client_ip(request)}"
    if not _limiter.is_allowed(key, max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="注册请求过于频繁，请稍后再试",
        )


def check_chat_limit(user_id: int):
    """聊天限流：同一用户每分钟最多 6 条消息"""
    key = f"chat:{user_id}"
    if not _limiter.is_allowed(key, max_requests=6, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="消息发送过于频繁，请稍后再试",
        )


def check_qa_limit(user_id: int):
    """问答限流：同一用户每分钟最多 5 次"""
    key = f"qa:{user_id}"
    if not _limiter.is_allowed(key, max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="提问过于频繁，请稍后再试",
        )


def reset_login_limit(request: Request):
    """登录成功后重置该 IP 的失败计数"""
    key = f"login:{_get_client_ip(request)}"
    _limiter.reset_key(key)
