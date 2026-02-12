# =============================================================================
# MLOps Pipeline Commands (Production EKS)
# =============================================================================
# All commands delegate to: scripts/infra/cli/mlops/manage.ts
# For private EKS clusters, kubectl commands are routed through Bastion via SSM.
# =============================================================================

# TypeScript MLOps manager
MLOPS := npx tsx scripts/infra/cli/mlops/manage.ts

.PHONY: mlops-build mlops-push mlops-deploy mlops-status mlops-verify mlops-clean
.PHONY: mlops-job mlops-logs mlops-logs-follow mlops-wait mlops-watch mlops-metrics mlops-results
.PHONY: mlops-e2e mlops-e2e-analytics mlops-clean-all mlops-info
.PHONY: mlops-smoke mlops-smoke-strict

# =============================================================================
# Docker Build & Push
# =============================================================================

# Build Docker image: make mlops-build [TAG=v1.0.0] [PLATFORM=linux/amd64]
mlops-build:
	$(MLOPS) build $(if $(TAG),--tag $(TAG),) $(if $(PLATFORM),--platform $(PLATFORM),)

# Build and push to ECR: make mlops-push [TAG=v1.0.0] [PLATFORM=linux/amd64]
mlops-push:
	$(MLOPS) push $(if $(TAG),--tag $(TAG),) $(if $(PLATFORM),--platform $(PLATFORM),)

# =============================================================================
# Kubernetes Deployment
# =============================================================================

mlops-deploy:
	$(MLOPS) deploy

# =============================================================================
# Job Execution
# =============================================================================

# Run specific job: make mlops-job JOB=preprocess
# Available jobs: preprocess, train, analytics, sentiment, generate, generate-reviews
mlops-job:
	$(MLOPS) job $(JOB)

mlops-preprocess:
	$(MLOPS) job preprocess

mlops-train:
	$(MLOPS) job train

mlops-analytics:
	$(MLOPS) job analytics

mlops-sentiment:
	$(MLOPS) job sentiment

mlops-generate-job:
	$(MLOPS) job generate

mlops-generate-reviews-job:
	$(MLOPS) job generate-reviews

# =============================================================================
# Job Logs & Wait
# =============================================================================

mlops-logs:
	$(MLOPS) logs $(STAGE)

mlops-logs-preprocess:
	$(MLOPS) logs preprocess

mlops-logs-train:
	$(MLOPS) logs train

mlops-logs-analytics:
	$(MLOPS) logs analytics

mlops-logs-sentiment:
	$(MLOPS) logs sentiment

mlops-logs-generate:
	$(MLOPS) logs generate

mlops-logs-generate-reviews:
	$(MLOPS) logs generate-reviews

mlops-wait:
	$(MLOPS) wait $(JOB)

# Follow logs in real-time: make mlops-logs-follow STAGE=analytics
mlops-logs-follow:
	$(MLOPS) logs-follow $(STAGE)

# Watch job status in real-time
mlops-watch:
	$(MLOPS) watch

# =============================================================================
# E2E Pipelines
# =============================================================================

mlops-e2e:
	$(MLOPS) pipeline

mlops-e2e-analytics:
	$(MLOPS) pipeline-analytics

# =============================================================================
# Status & Verification
# =============================================================================

mlops-status:
	$(MLOPS) status

mlops-verify:
	$(MLOPS) verify

mlops-metrics:
	$(MLOPS) metrics

mlops-results:
	$(MLOPS) results $(TYPE)

mlops-analytics-results:
	$(MLOPS) results analytics

mlops-sentiment-results:
	$(MLOPS) results sentiment

# =============================================================================
# Cleanup
# =============================================================================

mlops-clean:
	$(MLOPS) clean

mlops-clean-all:
	$(MLOPS) clean-all

# =============================================================================
# Info
# =============================================================================

mlops-info:
	$(MLOPS) info

# =============================================================================
# Smoke Test (MLOps readiness check)
# =============================================================================

# Run MLOps smoke test (verifies IRSA/S3 access)
mlops-smoke:
	$(MLOPS) smoke

# CI mode - exit 1 on failure
mlops-smoke-strict:
	$(MLOPS) smoke --strict
