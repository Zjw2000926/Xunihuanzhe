"""评分标准（Rubric）管理 —— 加载、版本追踪"""

import json
from pathlib import Path

_RUBRIC_DIR = Path(__file__).resolve().parent
_CACHE: dict[str, dict] = {}


def load_rubric(version: str = "nursing_history_v1") -> dict:
    """加载指定版本的评分标准，结果会被缓存"""
    if version in _CACHE:
        return _CACHE[version]

    path = _RUBRIC_DIR / f"{version}.json"
    if not path.exists():
        raise FileNotFoundError(f"评分标准文件不存在: {path}")

    with open(path, "r", encoding="utf-8") as f:
        rubric = json.load(f)

    _CACHE[version] = rubric
    return rubric


def get_rubric_versions() -> list[str]:
    """列出所有可用的评分标准版本"""
    versions = []
    for f in sorted(_RUBRIC_DIR.glob("nursing_history_*.json")):
        versions.append(f.stem)
    return versions


def get_rubric_version_id(rubric: dict) -> str:
    """生成格式化的版本标识，如 'nursing_history_v1@1.0'"""
    return f"{rubric.get('id', 'unknown')}@{rubric.get('version', '0')}"
