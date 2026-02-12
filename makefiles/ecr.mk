# =============================================================================
# ECR Operations
# =============================================================================
# All commands delegate to TypeScript: scripts/infra/tools/aws/ecr.ts
# Targets: frontend, backend, mlops (app is legacy monolith)
# =============================================================================

ECR := npx tsx $(INFRA_SCRIPTS)/tools/aws/ecr.ts

.PHONY: ecr-setup ecr-setup-mlops ecr-login ecr-login-public ecr-list ecr-targets
.PHONY: push push-app push-mlops push-public push-public-app push-public-mlops
.PHONY: push-frontend push-backend push-public-frontend push-public-backend

# =============================================================================
# Setup (Create Repositories)
# =============================================================================

ecr-setup: ecr-setup-frontend ecr-setup-backend

ecr-setup-app:
	$(ECR) create hono-app

ecr-setup-frontend:
	$(ECR) create app-frontend

ecr-setup-backend:
	$(ECR) create app-backend

ecr-setup-mlops:
	$(ECR) create mlops-pipeline

ecr-setup-all: ecr-setup-frontend ecr-setup-backend ecr-setup-mlops

# =============================================================================
# Login
# =============================================================================

ecr-login:
	$(ECR) login

ecr-login-public:
	$(ECR) login-public

# =============================================================================
# List & Info
# =============================================================================

ecr-list:
	$(ECR) list

ecr-targets:
	$(ECR) targets

ecr-show:
	$(ECR) show $(REPO)

# =============================================================================
# Build & Push (Private ECR)
# =============================================================================

# Default: push frontend and backend to private ECR
push: push-frontend push-backend

push-app:
	$(ECR) push app

push-frontend:
	$(ECR) push frontend

push-backend:
	$(ECR) push backend

push-mlops:
	$(ECR) push mlops

# With custom tag: make push-frontend TAG=v1.0.0
push-app-tag:
	$(ECR) push app --tag $(TAG)

push-frontend-tag:
	$(ECR) push frontend --tag $(TAG)

push-backend-tag:
	$(ECR) push backend --tag $(TAG)

push-mlops-tag:
	$(ECR) push mlops --tag $(TAG)

# =============================================================================
# Build & Push (Public ECR)
# =============================================================================

push-public: push-public-frontend push-public-backend

push-public-app:
	$(ECR) push-public app

push-public-frontend:
	$(ECR) push-public frontend

push-public-backend:
	$(ECR) push-public backend

push-public-mlops:
	$(ECR) push-public mlops

# =============================================================================
# Build Only (No Push)
# =============================================================================

build-app:
	$(ECR) build app

build-frontend:
	$(ECR) build frontend

build-backend:
	$(ECR) build backend

build-mlops:
	$(ECR) build mlops

build-app-no-cache:
	$(ECR) build app --no-cache

build-frontend-no-cache:
	$(ECR) build frontend --no-cache

build-backend-no-cache:
	$(ECR) build backend --no-cache

build-mlops-no-cache:
	$(ECR) build mlops --no-cache
