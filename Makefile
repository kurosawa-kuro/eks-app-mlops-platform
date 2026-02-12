# =============================================================================
# EKS MLOps Platform - Top Level Makefile
# =============================================================================
#
# 環境別プレフィックス:
#   local-*  : bare-metal開発（npm直接）
#   kind-*   : Kind開発（ローカルK8s）
#   eks-*    : EKS本番（AWS）
#   ecr-*    : ECR操作
#   mlops-*  : MLOps操作
#
# Usage:
#   make help          全コマンド一覧
#   make local-help    bare-metal開発コマンド
#   make kind-help     Kind開発コマンド
#   make eks-help      EKS本番コマンド
#
# =============================================================================

.DEFAULT_GOAL := help

# =============================================================================
# Include Modular Makefiles
# =============================================================================
include makefiles/shared.mk
include makefiles/local.mk
include makefiles/kind.mk
include makefiles/eks.mk
include makefiles/ecr.mk
include makefiles/mlops.mk

# =============================================================================
# PHONY declarations
# =============================================================================
.PHONY: help dev test lint build

# =============================================================================
# Quick Commands (Shortcuts)
# =============================================================================

# デフォルト開発: local-dev のエイリアス
dev: local-dev

# テスト: local-test のエイリアス
test: local-test

# Lint: local-lint のエイリアス
lint: local-lint

# ビルド: local-build のエイリアス
build: local-build

# =============================================================================
# Help
# =============================================================================
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  EKS MLOps Platform"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "Quick Commands:"
	@echo "  make dev               Start dev servers (= local-dev)"
	@echo "  make test              Run tests (= local-test)"
	@echo "  make lint              Run linter (= local-lint)"
	@echo "  make build             Build (= local-build)"
	@echo ""
	@echo "Environment-specific Help:"
	@echo "  make local-help        bare-metal development"
	@echo "  make kind-help         Kind (local K8s)"
	@echo "  make eks-help          EKS production (Phase Gate)"
	@echo "  make mlops-help        MLOps pipeline"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Prefixes"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  local-*    bare-metal (npm run dev)"
	@echo "  kind-*     Kind cluster (local K8s)"
	@echo "  shared-*   Shared infrastructure (ECR, S3)"
	@echo "  eks-*      EKS production (AWS)"
	@echo "  ecr-*      ECR operations"
	@echo "  mlops-*    MLOps pipeline"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Local Development (local-*)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  local-dev              BE + FE (8000/3000)"
	@echo "  local-dev-backend      Backend only"
	@echo "  local-dev-frontend     Frontend only"
	@echo "  local-test             Unit tests"
	@echo "  local-lint             ESLint"
	@echo "  local-db-migrate       Prisma migrate"
	@echo "  local-db-seed          Seed database"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Kind Development (kind-*)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  kind-create            Create Kind cluster"
	@echo "  kind-delete            Delete Kind cluster"
	@echo "  kind-dev               BE + FE (8001/3001)"
	@echo "  kind-build             Build Docker images"
	@echo "  kind-load              Load images to Kind"
	@echo "  kind-deploy            Deploy to Kind"
	@echo "  kind-status            Show cluster status"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  EKS Deployment (Phase Gate 構成)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  ★Gate = 完了条件（次のPhaseに進む前に必ず確認）"
	@echo ""
	@echo "  ┌─────────────────────────────────────────────────────────────────┐"
	@echo "  │ CONTROL PLANE (Phase 1-3)                                       │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ [P1] eks-smoke-aws         ★Gate AWS認証確認                   │"
	@echo "  │ [P2] shared-deploy → push  ★Gate ECR準備                       │"
	@echo "  │ [P3] eks-deploy → status   ★Gate EKS構築 (15-20分)            │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ ACCESS (Phase 4)                                                │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ [P4] eks-bastion-setup → eks-sync → eks-k8s-verify ★Gate      │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ RUNTIME (Phase 5-9)                                             │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ [P5] eks-k8s-init          Namespace/SA作成                     │"
	@echo "  │ [P6] eks-db-deploy → eks-secrets-create ★Gate DB              │"
	@echo "  │ [P7] eks-k8s-deploy        ★Gate App (K8S_OVERLAY=prod)       │"
	@echo "  │ [P8] eks-db-migrate → eks-auth-setup ★Gate PostDeploy         │"
	@echo "  │ [P9] eks-verify            ★Gate 最終検証                      │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ WORKLOAD (Phase 9a-10) - Optional                               │"
	@echo "  ├─────────────────────────────────────────────────────────────────┤"
	@echo "  │ [P9a] eks-monitoring-deploy → smoke ★Gate Monitoring          │"
	@echo "  │ [P9b] eks-argocd           Argo CD                              │"
	@echo "  │ [P10] mlops-*              MLOps Pipeline                       │"
	@echo "  └─────────────────────────────────────────────────────────────────┘"
	@echo ""
	@echo "  一括: make eks-deploy-all    削除: eks-destroy → shared-destroy"
	@echo ""
	@echo "  詳細: make eks-help"

