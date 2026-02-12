#!/bin/bash
# =============================================================================
# Development Server Launcher
# =============================================================================
# Backend + Frontend 同時起動（Ctrl+C で両方終了）
#
# Usage:
#   ./dev-server.sh <backend_dir> <frontend_dir> <backend_port> <frontend_port>
#
# Example:
#   ./dev-server.sh apps/app-backend apps/app-frontend 8000 3000
# =============================================================================

set -e

BACKEND_DIR="${1:-apps/app-backend}"
FRONTEND_DIR="${2:-apps/app-frontend}"
BACKEND_PORT="${3:-8000}"
FRONTEND_PORT="${4:-3000}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 既存プロセスをkill（EADDRINUSE防止）
for port in $BACKEND_PORT $FRONTEND_PORT; do
    if fuser "${port}/tcp" >/dev/null 2>&1; then
        echo -e "${BLUE}Killing existing process on port ${port}...${NC}"
        fuser -k "${port}/tcp" >/dev/null 2>&1 || true
        sleep 0.5
    fi
done

echo -e "${GREEN}Starting development servers...${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  Frontend: ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Ctrl+C で両方のプロセスを終了
trap 'echo ""; echo "Stopping servers..."; kill 0' EXIT

# Backend 起動
(
    cd "$BACKEND_DIR" && PORT=$BACKEND_PORT npm run dev
) &

# Frontend 起動
(
    cd "$FRONTEND_DIR" && \
    NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}" \
    PORT=$FRONTEND_PORT \
    npm run dev
) &

# 両方が終了するまで待機
wait
