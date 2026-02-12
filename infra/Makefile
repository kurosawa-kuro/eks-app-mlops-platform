# Infrastructure Makefile
SHELL := /bin/bash
SCRIPTS_DIR := scripts

.PHONY: help app mlops gpu-all gpu-status status tf-provision tf-destroy ecr-login ecr-list s3-list secrets-list

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================
# EKS Deploy (k8s-deploy.js)
# ============================================================

app: ## Deploy Hono app to EKS
	node $(SCRIPTS_DIR)/k8s-deploy.js app

app-alb: ## Deploy Hono app with ALB Controller
	node $(SCRIPTS_DIR)/k8s-deploy.js app --setup-alb

app-dry: ## Dry-run app deployment
	node $(SCRIPTS_DIR)/k8s-deploy.js app --dry-run

mlops: ## Deploy MLOps base resources
	node $(SCRIPTS_DIR)/k8s-deploy.js mlops

mlops-analytics: ## Run analytics job
	node $(SCRIPTS_DIR)/k8s-deploy.js mlops --job analytics --wait

mlops-sentiment: ## Run sentiment analysis job
	node $(SCRIPTS_DIR)/k8s-deploy.js mlops --job sentiment --wait

mlops-train: ## Run training job
	node $(SCRIPTS_DIR)/k8s-deploy.js mlops --job train --wait

gpu-all: ## Deploy full GPU/LLM infrastructure
	node $(SCRIPTS_DIR)/k8s-deploy.js gpu all

gpu-status: ## Show GPU/LLM status
	node $(SCRIPTS_DIR)/k8s-deploy.js gpu status

status: ## Show overall EKS status
	node $(SCRIPTS_DIR)/k8s-deploy.js status

# ============================================================
# Terraform
# ============================================================

tf-provision: ## Provision infrastructure with Terraform
	node $(SCRIPTS_DIR)/tf-provision.js

tf-destroy: ## Destroy infrastructure (interactive)
	node $(SCRIPTS_DIR)/tf-destroy.js

# ============================================================
# AWS Resources
# ============================================================

ecr-login: ## Docker login to ECR
	node $(SCRIPTS_DIR)/ecr-manage.js login

ecr-list: ## List ECR repositories
	node $(SCRIPTS_DIR)/ecr-manage.js list

s3-list: ## List S3 buckets
	node $(SCRIPTS_DIR)/s3-manage.js list

secrets-list: ## List secrets in Secrets Manager
	node $(SCRIPTS_DIR)/secrets-manage.js list
