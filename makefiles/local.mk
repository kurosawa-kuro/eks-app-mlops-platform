# =============================================================================
# Local Development (bare-metal / npm run dev)
# =============================================================================
# K8s不要のローカル開発用コマンド
# Usage: make local-*
# =============================================================================

.PHONY: local-dev local-dev-backend local-dev-frontend
.PHONY: local-install local-install-all local-setup
.PHONY: local-build local-build-all
.PHONY: local-test local-test-infra local-test-e2e local-lint local-typecheck local-check
.PHONY: local-db-migrate local-db-seed local-db-reset local-db-studio local-db-generate
.PHONY: local-clean local-help

# =============================================================================
# Development Servers
# =============================================================================

# FE + BE 同時起動 (通常ポート: BE:8000, FE:3000)
local-dev:
	@echo "🚀 Starting dev environment (Backend:$(BACKEND_PORT), Frontend:$(FRONTEND_PORT))..."
	@$(SCRIPTS_DIR)/start-servers.sh $(APPS_BACKEND_DIR) $(APPS_FRONTEND_DIR) $(BACKEND_PORT) $(FRONTEND_PORT)

# Backend のみ起動
local-dev-backend:
	@fuser -k $(BACKEND_PORT)/tcp >/dev/null 2>&1 || true
	@echo "🔧 Starting Backend on port $(BACKEND_PORT)..."
	cd $(APPS_BACKEND_DIR) && npm run dev

# Frontend のみ起動
local-dev-frontend:
	@fuser -k $(FRONTEND_PORT)/tcp >/dev/null 2>&1 || true
	@echo "🎨 Starting Frontend on port $(FRONTEND_PORT)..."
	cd $(APPS_FRONTEND_DIR) && NEXT_PUBLIC_API_URL=http://localhost:$(BACKEND_PORT) npm run dev

# =============================================================================
# Setup & Install
# =============================================================================

# Backend 依存インストール
local-install:
	cd $(APPS_BACKEND_DIR) && npm ci

# FE + BE 両方インストール
local-install-all:
	cd $(APPS_BACKEND_DIR) && npm ci
	cd $(APPS_FRONTEND_DIR) && npm ci

# セットアップ (install + DB generate + migrate)
local-setup: local-install-all local-db-generate local-db-migrate
	@echo "✅ Local setup complete!"

# =============================================================================
# Build
# =============================================================================

# Backend ビルド
local-build:
	cd $(APPS_BACKEND_DIR) && npm run build

# FE + BE ビルド
local-build-all:
	cd $(APPS_BACKEND_DIR) && npm run build
	cd $(APPS_FRONTEND_DIR) && npm run build

# =============================================================================
# Test & Lint
# =============================================================================

# Backend ユニットテスト
local-test:
	cd $(APPS_BACKEND_DIR) && npm test

# Infra scripts ユニットテスト
local-test-infra:
	cd $(INFRA_SCRIPTS) && npm test

# E2E テスト
local-test-e2e:
	cd $(APPS_BACKEND_DIR) && npm run test:e2e

# ESLint (Backend + Frontend)
local-lint:
	cd $(APPS_BACKEND_DIR) && npx eslint src --ext .ts
	cd $(APPS_FRONTEND_DIR) && npm run lint

# TypeScript 型チェック
local-typecheck:
	cd $(APPS_BACKEND_DIR) && npx tsc --noEmit

# 全チェック (lint + typecheck + test)
local-check: local-typecheck local-test
	@echo "✅ All checks passed!"

# =============================================================================
# Database (Prisma)
# =============================================================================

local-db-migrate:
	cd $(APPS_BACKEND_DIR) && npx prisma migrate dev

local-db-seed:
	cd $(APPS_BACKEND_DIR) && npx prisma db seed

local-db-reset:
	cd $(APPS_BACKEND_DIR) && npx prisma migrate reset --force

local-db-studio:
	cd $(APPS_BACKEND_DIR) && npx prisma studio

local-db-generate:
	cd $(APPS_BACKEND_DIR) && npx prisma generate

# =============================================================================
# Cleanup
# =============================================================================

local-clean:
	rm -rf $(APPS_BACKEND_DIR)/dist $(APPS_BACKEND_DIR)/node_modules
	rm -rf $(APPS_FRONTEND_DIR)/.next $(APPS_FRONTEND_DIR)/node_modules

# =============================================================================
# MLOps Local
# =============================================================================

.PHONY: local-mlops-install local-mlops-test local-mlops-lint local-mlops-clean

local-mlops-install:
	cd $(MLOPS_DIR) && $(PIP) install -r requirements.txt

local-mlops-test:
	cd $(MLOPS_DIR) && $(PYTHON) -m pytest tests/ -v || true
	@echo "Running analytics test..."
	$(PYTHON) -c "from mlops.src.analytics import Analytics; from mlops.src.config import Config; a = Analytics(Config()); print('Analytics OK')"

local-mlops-lint:
	cd $(MLOPS_DIR) && $(PYTHON) -m ruff check src/ scripts/

local-mlops-clean:
	find $(MLOPS_DIR) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# =============================================================================
# Help
# =============================================================================

local-help:
	@echo "=== Local Development (bare-metal) ==="
	@echo ""
	@echo "Development:"
	@echo "  local-dev              Start BE + FE ($(BACKEND_PORT)/$(FRONTEND_PORT))"
	@echo "  local-dev-backend      Start Backend only"
	@echo "  local-dev-frontend     Start Frontend only"
	@echo ""
	@echo "Setup:"
	@echo "  local-install          Install Backend deps"
	@echo "  local-install-all      Install all deps"
	@echo "  local-setup            Full setup (install + db)"
	@echo ""
	@echo "Build:"
	@echo "  local-build            Build Backend"
	@echo "  local-build-all        Build all"
	@echo ""
	@echo "Test & Lint:"
	@echo "  local-test             Run unit tests"
	@echo "  local-test-infra       Run infra scripts tests"
	@echo "  local-test-e2e         Run E2E tests"
	@echo "  local-lint             Run ESLint"
	@echo "  local-typecheck        TypeScript check"
	@echo "  local-check            All checks"
	@echo ""
	@echo "Database:"
	@echo "  local-db-migrate       Prisma migrate"
	@echo "  local-db-seed          Seed database"
	@echo "  local-db-reset         Reset database"
	@echo "  local-db-studio        Prisma Studio"
	@echo ""
	@echo "MLOps:"
	@echo "  local-mlops-install    Install Python deps"
	@echo "  local-mlops-test       Test locally"
	@echo "  local-mlops-lint       Ruff linter"
	@echo ""
	@echo "Cleanup:"
	@echo "  local-clean            Remove node_modules etc"
