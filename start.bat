@echo off
chcp 65001 >nul
echo ============================================
echo   虚拟患者训练系统 - 生产模式启动
echo ============================================

set UVICORN_WORKERS=4

cd /d "%~dp0backend"

echo [1/4] 检查依赖...
pip install -r requirements.txt -q -i https://pypi.tuna.tsinghua.edu.cn/simple/ 2>nul

echo [2/4] 执行数据库迁移...
python -c "from alembic.config import Config; from alembic import command; cfg = Config('alembic.ini'); command.upgrade(cfg, 'head')" 2>nul
if %errorlevel% neq 0 (
    echo [警告] 数据库迁移失败，回退到 create_all...
)

echo [3/4] 启动后端 (%UVICORN_WORKERS% workers)...
start "VirtualPatient-Backend" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000 --workers %UVICORN_WORKERS%"

cd /d "%~dp0frontend"

echo [4/4] 构建前端...
call npm run build 2>nul

echo.
echo ============================================
echo   后端 API: http://localhost:8000
echo   健康检查: http://localhost:8000/api/health
echo   前端构建: frontend\dist (StaticFiles / Nginx 提供服务)
echo ============================================
echo.
echo 按任意键退出...
pause >nul
