# =============================================================================
# Shared Variables & Configuration
# =============================================================================
# All environment-specific makefiles should include this file first.
# Usage: include makefiles/shared.mk
# =============================================================================

# -----------------------------------------------------------------------------
# Directories
# -----------------------------------------------------------------------------
APPS_BACKEND_DIR := apps/app-backend
APPS_FRONTEND_DIR := apps/app-frontend
MLOPS_DIR := mlops
INFRA_DIR := infra
SCRIPTS_DIR := scripts/apps

# Infrastructure scripts (TypeScript)
INFRA_SCRIPTS := scripts/infra
EKS_TF_DIR := infra/terraform/prod
SHARED_TF_DIR := infra/terraform/shared
EKS_MANIFESTS := infra/k8s/overlays/prod

# -----------------------------------------------------------------------------
# Ports (can be overridden)
# -----------------------------------------------------------------------------
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000

# Kind development uses different ports to avoid conflicts
KIND_BACKEND_PORT ?= 8001
KIND_FRONTEND_PORT ?= 3001

# -----------------------------------------------------------------------------
# Docker Images
# -----------------------------------------------------------------------------
BACKEND_IMAGE := app-backend
FRONTEND_IMAGE := app-frontend
MLOPS_IMAGE := mlops-pipeline

# -----------------------------------------------------------------------------
# Kubernetes
# -----------------------------------------------------------------------------
KIND_CLUSTER := dev-cluster
K8S_NAMESPACE := app
K8S_LOCAL_OVERLAY := infra/k8s/apps/overlays/local
K8S_PROD_OVERLAY := infra/k8s/overlays/prod

# -----------------------------------------------------------------------------
# Python (MLOps)
# -----------------------------------------------------------------------------
PYTHON := python3
PIP := pip3
