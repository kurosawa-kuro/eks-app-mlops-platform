#!/bin/bash
# =============================================================================
# Development Environment Setup
# =============================================================================
# 開発環境の初期セットアップを行います。
#
# Usage:
#   ./setup-dev-env.sh           # 全セットアップ
#   ./setup-dev-env.sh --env     # 環境変数ファイルのみ
#   ./setup-dev-env.sh --deps    # 依存関係のみ
#   ./setup-dev-env.sh --db      # DB セットアップのみ
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/app-backend"
FRONTEND_DIR="$PROJECT_ROOT/apps/app-frontend"

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

print_header() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 環境変数ファイルのセットアップ
setup_env_files() {
    print_header "Environment Files"

    # Backend .env
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            print_success "Created apps/app-backend/.env from .env.example"
            print_warning "Please update DATABASE_URL in .env"
        else
            print_error "apps/app-backend/.env.example not found"
        fi
    else
        print_success "apps/app-backend/.env already exists"
    fi

    # Frontend .env.local
    if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
        echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > "$FRONTEND_DIR/.env.local"
        print_success "Created apps/app-frontend/.env.local"
    else
        print_success "apps/app-frontend/.env.local already exists"
    fi
}

# 依存関係のインストール
install_dependencies() {
    print_header "Dependencies"

    # Backend
    if [ -d "$BACKEND_DIR/node_modules" ]; then
        print_success "Backend dependencies already installed"
    else
        echo "Installing backend dependencies..."
        (cd "$BACKEND_DIR" && npm ci)
        print_success "Backend dependencies installed"
    fi

    # Frontend
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        print_success "Frontend dependencies already installed"
    else
        echo "Installing frontend dependencies..."
        (cd "$FRONTEND_DIR" && npm ci)
        print_success "Frontend dependencies installed"
    fi
}

# Prisma セットアップ
setup_database() {
    print_header "Database (Prisma)"

    if [ -f "$BACKEND_DIR/.env" ]; then
        # Check if DATABASE_URL is set
        if grep -q "^DATABASE_URL=.\+" "$BACKEND_DIR/.env"; then
            echo "Running Prisma generate..."
            (cd "$BACKEND_DIR" && npx prisma generate)
            print_success "Prisma client generated"

            echo ""
            echo -e "${YELLOW}To run migrations:${NC}"
            echo "  make local-db-migrate"
            echo ""
            echo -e "${YELLOW}To seed database:${NC}"
            echo "  make local-db-seed"
        else
            print_warning "DATABASE_URL is not set in .env"
            print_warning "Please set DATABASE_URL and run: make local-db-migrate"
        fi
    else
        print_error ".env file not found, skipping database setup"
    fi
}

# ヘルプ表示
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --env     Setup environment files only"
    echo "  --deps    Install dependencies only"
    echo "  --db      Setup database (Prisma) only"
    echo "  --help    Show this help"
    echo ""
    echo "Without options, runs full setup."
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    echo -e "${BLUE}"
    echo "============================================"
    echo " EKS MLOps Platform - Dev Environment Setup"
    echo "============================================"
    echo -e "${NC}"

    case "${1:-}" in
        --env)
            setup_env_files
            ;;
        --deps)
            install_dependencies
            ;;
        --db)
            setup_database
            ;;
        --help)
            show_help
            exit 0
            ;;
        "")
            # Full setup
            setup_env_files
            install_dependencies
            setup_database
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac

    print_header "Done"
    echo ""
    echo "Next steps:"
    echo "  1. Update DATABASE_URL in apps/app-backend/.env"
    echo "  2. Run: make local-db-migrate"
    echo "  3. Run: make local-dev"
    echo ""
}

main "$@"
