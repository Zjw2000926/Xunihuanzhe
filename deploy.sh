#!/usr/bin/env bash
# ============================================================
# 虚拟患者训练系统 — 一键部署脚本
#
# 用法:
#   ./deploy.sh                    # 本地构建 + 启动
#   ./deploy.sh --prod v1.17.0     # 生产部署（使用 GHCR 镜像）
#   ./deploy.sh --setup            # 首次服务器初始化
# ============================================================
set -e

DEPLOY_DIR="/opt/xunihuanzhe"
MODE="local"

# ── 解析参数 ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod) MODE="prod"; VERSION="${2:?缺少版本号}"; shift 2 ;;
    --setup) MODE="setup"; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

# ── 首次服务器初始化 ──
if [ "$MODE" = "setup" ]; then
  echo "=== 初始化部署目录 ==="
  sudo mkdir -p "$DEPLOY_DIR"/{cases,backups}
  sudo chown -R "$USER:$USER" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"

  if [ ! -f .env ]; then
    echo "# 请填入你的 DeepSeek API Key" > .env
    echo "DEEPSEEK_API_KEY=sk-your-key-here" >> .env
    echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
    echo "CORS_ORIGINS=http://localhost" >> .env
    echo ">> .env 已生成，请编辑填入正确的 DEEPSEEK_API_KEY"
  fi

  # 拷贝病例文件
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  cp -r "$SCRIPT_DIR/backend/cases/"* "$DEPLOY_DIR/cases/"
  echo ">> 病例文件已拷贝到 $DEPLOY_DIR/cases/"
  echo ">> 初始化完成。请编辑 $DEPLOY_DIR/.env 后运行:"
  echo "   ./deploy.sh --prod <版本号>"
  exit 0
fi

# ── 本地构建部署 ──
if [ "$MODE" = "local" ]; then
  echo "=== 本地构建部署 ==="
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  cd "$SCRIPT_DIR"

  if [ ! -f .env ]; then
    echo "错误: 缺少 .env 文件，请从 .env.example 复制并填入 DEEPSEEK_API_KEY"
    exit 1
  fi

  docker compose down --timeout 30 2>/dev/null || true
  docker compose up -d --build
  echo ">> 部署完成: http://localhost"
  exit 0
fi

# ── 生产部署（使用 GHCR 预构建镜像） ──
if [ "$MODE" = "prod" ]; then
  echo "=== 生产部署: $VERSION ==="
  REPO="${GITHUB_REPOSITORY_OWNER:-zjw2000926}"
  IMG_BACKEND="ghcr.io/$REPO/xunihuanzhe-backend:$VERSION"
  IMG_FRONTEND="ghcr.io/$REPO/xunihuanzhe-frontend:$VERSION"

  cd "$DEPLOY_DIR"

  # 登录 GHCR（首次需要）
  if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$REPO" --password-stdin
  fi

  docker pull "$IMG_BACKEND"
  docker pull "$IMG_FRONTEND"

  # 生成 compose 文件
  cat > docker-compose.yml << COMPOSE
services:
  backend:
    image: $IMG_BACKEND
    ports: ["8000:8000"]
    volumes:
      - db_data:/app/data
      - ./cases:/app/cases:ro
    env_file: [.env]
    environment:
      - DATABASE_URL=sqlite:///data/data.db
    restart: unless-stopped

  frontend:
    image: $IMG_FRONTEND
    ports: ["80:80"]
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

volumes:
  db_data:
COMPOSE

  docker compose down --timeout 30
  docker compose up -d
  docker image prune -f

  echo ">> 部署完成: http://$(hostname -I | awk '{print $1}')"
fi
