# Production EKS Makefile
# Usage: make <target>

.PHONY: help init plan apply provision provision-skip-apply provision-timeout destroy destroy-dry destroy-full destroy-skip-k8s destroy-force bastion bastion-id deploy deploy-dry fetch-cert upload health status logs output fmt validate kubeconfig clean

REGION := ap-northeast-1
OVERLAY := prod

# Colors
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)Production EKS Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'

#--------------------------------------------------
# Terraform
#--------------------------------------------------

init: ## Initialize Terraform
	terraform init

plan: ## Show Terraform plan
	terraform plan

apply: ## Apply (without monitoring, use 'provision' instead)
	terraform apply

#--------------------------------------------------
# Provision (recommended)
#--------------------------------------------------

provision: ## ★ Provision with full monitoring (recommended)
	node ../../scripts/infra/tf-provision.js

provision-skip-apply: ## Monitoring only (skip terraform apply)
	node ../../scripts/infra/tf-provision.js --skip-apply

provision-timeout: ## Custom timeout (usage: make provision-timeout T=900)
	node ../../scripts/infra/tf-provision.js --timeout $(T)

#--------------------------------------------------
# Destroy (recommended: use destroy-full)
#--------------------------------------------------

destroy: ## terraform destroy only (use 'destroy-full' instead)
	@echo "$(YELLOW)WARNING: This will destroy all production infrastructure!$(NC)"
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	terraform destroy

destroy-full: ## ★ Full destroy with cleanup (recommended)
	node ../../scripts/infra/tf-destroy.js --force

destroy-dry: ## Dry-run destroy (show what would be deleted)
	node ../../scripts/infra/tf-destroy.js --dry-run

destroy-skip-k8s: ## Skip K8s cleanup in destroy
	node ../../scripts/infra/tf-destroy.js --skip-k8s

destroy-force: ## Destroy without confirmation (danger)
	node ../../scripts/infra/tf-destroy.js --force

fmt: ## Format Terraform files
	terraform fmt -recursive

validate: ## Validate Terraform configuration
	terraform validate

output: ## Show Terraform outputs
	terraform output

#--------------------------------------------------
# Bastion
#--------------------------------------------------

bastion: ## Connect to bastion via SSM
	@INSTANCE_ID=$$(terraform output -raw bastion_instance_id 2>/dev/null); \
	if [ -z "$$INSTANCE_ID" ]; then \
		echo "$(YELLOW)Error: Could not get bastion instance ID$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Connecting to bastion: $$INSTANCE_ID$(NC)"; \
	aws ssm start-session --target $$INSTANCE_ID --region $(REGION)

bastion-id: ## Show bastion instance ID
	@terraform output -raw bastion_instance_id

#--------------------------------------------------
# Deploy
#--------------------------------------------------

deploy: ## Deploy application to EKS via Bastion
	node ../../scripts/k8s-app-deploy.js --overlay $(OVERLAY)

deploy-dry: ## Deploy dry-run (no actual changes)
	node ../../scripts/k8s-app-deploy.js --overlay $(OVERLAY) --dry-run

upload: ## Upload manifests to S3 only
	@BUCKET=$$(terraform output -raw s3_bucket_name 2>/dev/null); \
	if [ -z "$$BUCKET" ]; then \
		echo "$(YELLOW)Error: Could not get S3 bucket name$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Uploading to s3://$$BUCKET/k8s-manifests/$(NC)"; \
	aws s3 sync ../../../infra/k8s/ s3://$$BUCKET/k8s-manifests/ --delete

#--------------------------------------------------
# Health Check
#--------------------------------------------------

health: ## Show health check commands (run on bastion)
	@echo "$(BLUE)Run these commands on bastion:$(NC)"
	@echo ""
	@echo "# Pod status"
	@echo "kubectl get pods -n app -o wide"
	@echo ""
	@echo "# Service"
	@echo "kubectl get svc -n app"
	@echo ""
	@echo "# Health check (backend)"
	@echo "kubectl exec -n app \$$(kubectl get pods -n app -l app=app-backend -o jsonpath='{.items[0].metadata.name}') -- wget -qO- http://localhost:8000/health"
	@echo ""
	@echo "# Logs (backend)"
	@echo "kubectl logs -n app -l app=app-backend --tail=50"

status: ## Show cluster status (run on bastion)
	@echo "$(BLUE)Run these commands on bastion:$(NC)"
	@echo ""
	@echo "# Nodes"
	@echo "kubectl get nodes"
	@echo ""
	@echo "# All Pods"
	@echo "kubectl get pods -A"
	@echo ""
	@echo "# Component status"
	@echo "kubectl get cs"

logs: ## Show log commands (run on bastion)
	@echo "$(BLUE)Run these commands on bastion:$(NC)"
	@echo ""
	@echo "# Recent logs (backend)"
	@echo "kubectl logs -n app -l app=app-backend --tail=100"
	@echo ""
	@echo "# Recent logs (frontend)"
	@echo "kubectl logs -n app -l app=app-frontend --tail=100"
	@echo ""
	@echo "# Follow logs"
	@echo "kubectl logs -n app -l app=app-backend -f"
	@echo ""
	@echo "# Events"
	@echo "kubectl get events -n app --sort-by=.lastTimestamp | tail -20"

#--------------------------------------------------
# Utilities
#--------------------------------------------------

kubeconfig: ## Show kubeconfig setup command
	@echo "$(BLUE)Run on bastion to setup kubeconfig:$(NC)"
	@terraform output -raw bastion_eks_setup_command

clean: ## Clean Terraform cache
	rm -rf .terraform/
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate.backup
