# =============================================================================
# Kind Development (Local Kubernetes)
# =============================================================================
# Kind クラスタを使ったローカル K8s 開発用コマンド
# Usage: make kind-*
#
# 実装: scripts/infra/tools/kubernetes/kind.ts
# =============================================================================

# TypeScript CLI
KIND_CLI := npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/kind.ts

.PHONY: kind-create kind-delete kind-status kind-context kind-info
.PHONY: kind-dev kind-dev-backend kind-dev-frontend
.PHONY: kind-build-backend kind-build-frontend kind-build-all
.PHONY: kind-load-backend kind-load-frontend kind-load-all
.PHONY: kind-deploy kind-undeploy kind-restart kind-full
.PHONY: kind-logs kind-logs-backend kind-logs-frontend
.PHONY: kind-port-forward-backend kind-port-forward-frontend
.PHONY: kind-help

# =============================================================================
# Cluster Management (via kind-manage.ts)
# =============================================================================

kind-create:
	@$(KIND_CLI) create

kind-delete:
	@$(KIND_CLI) delete

kind-status:
	@$(KIND_CLI) status

kind-context:
	@$(KIND_CLI) context

kind-info:
	@$(KIND_CLI) info

# =============================================================================
# Development Servers (ポート競合回避)
# =============================================================================
# Kind 環境では BE:8001, FE:3001 を使用（local-* と競合しない）
# ※ これらは npm run dev を直接実行するため Makefile に残す

kind-dev:
	@echo "Starting Kind dev environment (Backend:$(KIND_BACKEND_PORT), Frontend:$(KIND_FRONTEND_PORT))..."
	@trap 'kill 0' EXIT; \
	cd $(APPS_BACKEND_DIR) && PORT=$(KIND_BACKEND_PORT) npm run dev & \
	cd $(APPS_FRONTEND_DIR) && NEXT_PUBLIC_API_URL=http://localhost:$(KIND_BACKEND_PORT) PORT=$(KIND_FRONTEND_PORT) npm run dev & \
	wait

kind-dev-backend:
	@echo "Starting Backend on port $(KIND_BACKEND_PORT)..."
	cd $(APPS_BACKEND_DIR) && PORT=$(KIND_BACKEND_PORT) npm run dev

kind-dev-frontend:
	@echo "Starting Frontend on port $(KIND_FRONTEND_PORT)..."
	cd $(APPS_FRONTEND_DIR) && NEXT_PUBLIC_API_URL=http://localhost:$(KIND_BACKEND_PORT) PORT=$(KIND_FRONTEND_PORT) npm run dev

# =============================================================================
# Docker Build (via kind-manage.ts)
# =============================================================================

kind-build-backend:
	@$(KIND_CLI) build backend

kind-build-frontend:
	@$(KIND_CLI) build frontend

kind-build-all:
	@$(KIND_CLI) build all

# =============================================================================
# Load Images to Kind (via kind-manage.ts)
# =============================================================================

kind-load-backend:
	@$(KIND_CLI) load backend

kind-load-frontend:
	@$(KIND_CLI) load frontend

kind-load-all:
	@$(KIND_CLI) load all

# =============================================================================
# Kubernetes Deploy (via kind-manage.ts)
# =============================================================================

kind-deploy:
	@$(KIND_CLI) deploy

kind-undeploy:
	@$(KIND_CLI) undeploy

kind-restart:
	@$(KIND_CLI) restart

# フルパイプライン: build → load → deploy
kind-full:
	@$(KIND_CLI) build-deploy

# =============================================================================
# Logs (via kind-manage.ts)
# =============================================================================

kind-logs:
	@$(KIND_CLI) logs backend --follow

kind-logs-backend:
	@$(KIND_CLI) logs backend --follow

kind-logs-frontend:
	@$(KIND_CLI) logs frontend --follow

# =============================================================================
# Port Forward (via kind-manage.ts)
# =============================================================================

kind-port-forward-backend:
	@$(KIND_CLI) port-forward backend

kind-port-forward-frontend:
	@$(KIND_CLI) port-forward frontend

# =============================================================================
# Help
# =============================================================================

kind-help:
	@$(KIND_CLI) help
