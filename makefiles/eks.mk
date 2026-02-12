# =============================================================================
# EKS (Production) Operations - Phase Gate 構成
# =============================================================================
#
# README Make EKS MLops.md の Phase Gate に準拠した構成
#
# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ Control Plane (Phase 1-3)  : AWS認証 → Shared → EKS構築                    │
# │ Access       (Phase 4)     : Bastion/SSM/kubectl動線                        │
# │ Runtime      (Phase 5-9)   : NS/SA → DB → App → PostDeploy → 検証          │
# │ Workload     (Phase 9a-10) : Monitoring → Argo CD → MLOps                  │
# └─────────────────────────────────────────────────────────────────────────────┘
#
# Gate原則:
#   - 各Phaseの完了条件（Gate）を満たすまで次へ進まない
#   - 失敗時は「戻り先ルール」に従う
#   - kubectl を直接叩かない（すべて make eks-* 経由）
#
# =============================================================================

# =============================================================================
# PHONY declarations
# =============================================================================
.PHONY: eks-prereq eks-prereq-install eks-deploy-all
.PHONY: eks-smoke-aws
.PHONY: shared-init shared-plan shared-deploy shared-destroy
.PHONY: eks-init eks-plan eks-deploy eks-destroy eks-kubeconfig eks-status
.PHONY: eks-bastion eks-bastion-status eks-bastion-start eks-bastion-stop eks-bastion-setup
.PHONY: eks-sync eks-bastion-exec eks-bastion-kubectl eks-bastion-apply
.PHONY: eks-k8s-verify
.PHONY: eks-k8s-init eks-k8s-status
.PHONY: eks-smoke-eks
.PHONY: eks-db-deploy eks-db-status eks-db-cluster eks-db-describe eks-db-logs
.PHONY: eks-secrets-create
.PHONY: eks-k8s-deploy eks-k8s-deploy-backend eks-k8s-deploy-frontend
.PHONY: eks-k8s-health eks-ingress-verify
.PHONY: eks-db-migrate eks-db-seed eks-auth-setup
.PHONY: eks-verify eks-verify-health eks-verify-login
.PHONY: eks-smoke eks-smoke-strict eks-smoke-json eks-smoke-k8s eks-smoke-app
.PHONY: eks-monitoring-deploy eks-monitoring-status eks-monitoring-smoke eks-monitoring-smoke-strict
.PHONY: eks-monitoring-open eks-monitoring-grafana eks-monitoring-prometheus eks-monitoring-alertmanager eks-monitoring-loki
.PHONY: eks-monitoring-smoke-prometheus eks-monitoring-smoke-grafana eks-monitoring-smoke-loki eks-monitoring-smoke-alertmanager
.PHONY: eks-argocd-deploy eks-argocd eks-argocd-status eks-argocd-password eks-argocd-smoke eks-argocd-apps eks-argocd-repo-secret
.PHONY: eks-k8s-nodes eks-k8s-events eks-k8s-logs eks-k8s-describe eks-k8s-secrets eks-k8s-restart
.PHONY: eks-help

# =============================================================================
# Phase 0: Prerequisites（前提条件）
# =============================================================================
# Gate: eks-prereq が成功すること
# -----------------------------------------------------------------------------

eks-prereq: ## [P0] 前提条件チェック (AWS CLI, SSM plugin)
	npx tsx $(INFRA_SCRIPTS)/tools/setup/prerequisites.ts check

eks-prereq-install: ## [P0] SSM Session Manager Plugin インストール
	npx tsx $(INFRA_SCRIPTS)/tools/setup/prerequisites.ts install

eks-deploy-all: ## [P0] Phase 1-9 一括デプロイ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/deploy-all.ts run $(if $(FROM),--from=$(FROM),)

# =============================================================================
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
# ┃ CONTROL PLANE (Phase 1-3)                                                ┃
# ┃ AWS認証 → Shared → EKS構築                                               ┃
# ┃                                                                          ┃
# ┃ 典型的な壊れ: AWS認証切れ / Terraform state不整合 / ECR push失敗        ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
# =============================================================================

# -----------------------------------------------------------------------------
# Phase 1: AWS 認証確認
# -----------------------------------------------------------------------------
# Gate: eks-smoke-aws
# 失敗時の戻り先: AWS credentials 再設定
# -----------------------------------------------------------------------------

eks-smoke-aws: ## [P1] ★Gate AWS認証 + リージョン確認
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts aws

# -----------------------------------------------------------------------------
# Phase 2: Shared + ECR
# -----------------------------------------------------------------------------
# Gate: shared-deploy, ecr-login, push 全て成功
# 失敗時の戻り先: Phase 2
# -----------------------------------------------------------------------------

shared-init: ## [P2] Shared Terraform 初期化
	cd $(SHARED_TF_DIR) && terraform init

shared-plan: ## [P2] Shared プラン確認
	cd $(SHARED_TF_DIR) && terraform plan

shared-deploy: ## [P2] ★Gate ECR, S3, Firehose 作成
	cd $(SHARED_TF_DIR) && terraform apply -auto-approve

shared-destroy: ## [削除] Shared リソース削除
	cd $(SHARED_TF_DIR) && terraform destroy -auto-approve

# ECR 操作は ecr.mk を参照: ecr-login, push

# -----------------------------------------------------------------------------
# Phase 3: EKS インフラ構築
# -----------------------------------------------------------------------------
# Gate: eks-status で ACTIVE + nodegroup生成完了
# 失敗時の戻り先: Phase 3（tf）or Shared差分確認
#
# バックグラウンド実行推奨 (15-20分):
#   time make eks-deploy &
#   tail -f /tmp/claude/-home-ubuntu-repos-.../tasks/*.output
# -----------------------------------------------------------------------------

eks-init: ## [P3] EKS Terraform 初期化
	cd $(EKS_TF_DIR) && terraform init

eks-plan: ## [P3] EKS プラン確認
	cd $(EKS_TF_DIR) && terraform plan

eks-deploy: ## [P3] EKS クラスタ作成 (15-20分, SKIP_APPLY=1 でterraformスキップ)
	npx tsx $(INFRA_SCRIPTS)/cli/terraform/apply.ts apply $(if $(SKIP_APPLY),--skip-apply,)

eks-status: ## [P3] ★Gate Terraform 状態確認 (ACTIVE + nodegroup確認)
	npx tsx $(INFRA_SCRIPTS)/cli/terraform/status.ts status

eks-kubeconfig: ## [P3] kubeconfig 更新 (ローカル用、通常不要)
	aws eks update-kubeconfig --region ap-northeast-1 --name prod-eks-cluster

# =============================================================================
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
# ┃ ACCESS (Phase 4)                                                         ┃
# ┃ Bastion/SSM/kubectl動線                                                   ┃
# ┃                                                                          ┃
# ┃ ★ここを通らない限り以降のkubectl操作を禁止                               ┃
# ┃ 典型例: SSM未Online / sync漏れ / ローカルkubectl誤用                      ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
# =============================================================================

# -----------------------------------------------------------------------------
# Phase 4: Bastion セットアップ
# -----------------------------------------------------------------------------
# Gate: eks-k8s-verify (kubectl get nodes OK)
# 失敗時の戻り先: Phase 4
# -----------------------------------------------------------------------------

eks-bastion-status: ## [P4] SSM Agent Online 確認
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts status

eks-bastion-setup: ## [P4] kubectl/helm セットアップ
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts setup

eks-sync: ## [P4] ワークスペース同期 (ローカル → Bastion, S3経由)
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts sync

eks-k8s-verify: ## [P4] ★Gate kubectl動線確認 (kubectl get nodes)
	@echo "=== K8s Verify: kubectl get nodes ==="
	$(MAKE) eks-bastion-kubectl CMD="get nodes -o wide"

# Bastion 接続・実行
eks-bastion: ## [P4] Bastion SSM接続 (インタラクティブ)
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts connect

eks-bastion-start: ## [P4] Bastion 起動
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts start

eks-bastion-stop: ## [P4] Bastion 停止
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts stop

eks-bastion-exec: ## [P4] 任意コマンド実行 (CMD="xxx")
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts exec "$(CMD)"

eks-bastion-kubectl: ## [P4] kubectl 実行 (CMD="get pods -n app")
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts kubectl $(CMD)

eks-bastion-apply: ## [P4] kustomize apply (OVERLAY=prod PATH=apps)
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts kubectl apply -k ~/workspace/infra/k8s/$(PATH)/overlays/$(OVERLAY)

# =============================================================================
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
# ┃ RUNTIME (Phase 5-9)                                                      ┃
# ┃ NS/SA → DB → App → PostDeploy → 検証                                    ┃
# ┃                                                                          ┃
# ┃ ★ここで壊れる原因の8割は DB / Secret / Auth                              ┃
# ┃ Pod自体が死ぬ場合は Phase 6 に戻る                                       ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
# =============================================================================

# -----------------------------------------------------------------------------
# Phase 5: Namespace/ServiceAccount
# -----------------------------------------------------------------------------
# Gate: eks-k8s-status で namespace/sa 存在確認
# Smoke: eks-smoke-eks (ログ基盤確認)
# -----------------------------------------------------------------------------

eks-k8s-init: ## [P5] Namespace + ServiceAccount 作成
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/init.ts

eks-k8s-status: ## [P5] ★Gate Pod/Service 状態確認
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts pods

eks-smoke-eks: ## [P5] Smoke: CloudWatch Logs / VPC Flow Logs 確認
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts eks

# -----------------------------------------------------------------------------
# Phase 6: Database (CNPG)
# -----------------------------------------------------------------------------
# Gate: eks-db-status で Primary Ready + eks-secrets-create
# 失敗時の最短導線: eks-db-logs / eks-db-describe
#
# ★このPhaseを通過していない状態でAppに進んではいけない
# -----------------------------------------------------------------------------

eks-db-deploy: ## [P6] CNPG Operator + PostgreSQL Cluster
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts deploy

eks-db-status: ## [P6] ★Gate データベース状態確認 (Primary Ready)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts status

eks-secrets-create: ## [P6] ★Gate app-backend-secrets 作成 (DATABASE_URL, JWT_SECRET)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts secrets

# DB デバッグ
eks-db-cluster: ## [P6] CNPG Cluster 詳細
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts cluster

eks-db-describe: ## [P6] PostgreSQL cluster describe (verbose)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts describe

eks-db-logs: ## [P6] Database Pod ログ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts logs

# -----------------------------------------------------------------------------
# Phase 7: App デプロイ
# -----------------------------------------------------------------------------
# Gate: eks-k8s-status で backend/frontend Ready
# 前提: export K8S_OVERLAY=prod
#
# 確認ポイント:
#   - Pod が Running 状態か
#   - CrashLoopBackOff や Error がないか
#   - eks-ingress-verify で URL早期確認
# -----------------------------------------------------------------------------

eks-k8s-deploy: ## [P7] ★Gate Frontend + Backend デプロイ (K8S_OVERLAY=prod)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/deploy.ts app

eks-k8s-deploy-backend: ## [P7] Backend のみデプロイ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/deploy.ts app --backend-only

eks-k8s-deploy-frontend: ## [P7] Frontend のみデプロイ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/deploy.ts app --frontend-only

eks-k8s-health: ## [P7] Health check (curl pod 経由)
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts health

eks-ingress-verify: ## [P7] Ingress URL 確認 (DNS/SSL/HTTP)
	npx tsx $(INFRA_SCRIPTS)/cli/infra/verify.ts ingress

# -----------------------------------------------------------------------------
# Phase 8: PostDeploy
# -----------------------------------------------------------------------------
# Gate: eks-db-migrate, eks-db-seed, eks-auth-setup 全て成功
# 注意: auth setup は再起動を含む → Phase 7 の Ready が一瞬崩れる
# -----------------------------------------------------------------------------

eks-db-migrate: ## [P8] マイグレーション実行 (prisma migrate deploy)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts migrate

eks-db-seed: ## [P8] シードデータ投入
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts seed

eks-auth-setup: ## [P8] ★Gate AUTH_SERVICE_URL 設定 (Pod再起動あり)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/db-deploy.ts auth

# -----------------------------------------------------------------------------
# Phase 9: 最終検証
# -----------------------------------------------------------------------------
# Gate: eks-verify (Health + Login)
# Strict: eks-smoke-strict (CI/再現性向け)
#
# サービス URL:
#   Frontend: https://app.tk-k8s.com
#   API:      https://api.tk-k8s.com
#   Health:   https://api.tk-k8s.com/health
# -----------------------------------------------------------------------------

eks-verify: ## [P9] ★Gate Health + Login 検証
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/verify.ts all

eks-verify-health: ## [P9] Health check のみ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/verify.ts health

eks-verify-login: ## [P9] Login test のみ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/verify.ts login

eks-smoke: ## [P9] Smoke テスト
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts run

eks-smoke-strict: ## [P9] ★Gate Smoke テスト (CI, exit 1 on failure)
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts run --strict

eks-smoke-json: ## [P9] Smoke テスト (JSON出力)
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts run --json

eks-smoke-k8s: ## [P9] K8s Smoke のみ
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts k8s

eks-smoke-app: ## [P9] App Smoke のみ
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts app

# =============================================================================
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
# ┃ WORKLOAD (Phase 9a-10)                                                   ┃
# ┃ Monitoring → Argo CD → MLOps (Optional/拡張枠)                           ┃
# ┃                                                                          ┃
# ┃ ★Appが正常でない状態でここに入らない（二次障害で時間を溶かす）           ┃
# ┃ 典型例: IRSA未設定 / S3バケット不在 / ECR Public認証切れ                 ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
# =============================================================================

# -----------------------------------------------------------------------------
# Phase 9a: Monitoring Stack (Optional)
# -----------------------------------------------------------------------------
# Gate: eks-monitoring-status, eks-monitoring-smoke
# UI: eks-monitoring-grafana → localhost:3000 (admin/CHANGE_ME)
# -----------------------------------------------------------------------------

eks-monitoring-deploy: ## [P9a] ★Gate Prometheus, Grafana, Loki デプロイ
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/monitoring.ts deploy

eks-monitoring-status: ## [P9a] Monitoring Stack 状態確認
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/monitoring.ts status

eks-monitoring-smoke: ## [P9a] ★Gate Monitoring Smoke テスト
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts monitoring

eks-monitoring-smoke-strict: ## [P9a] Monitoring Smoke (CI, exit 1 on failure)
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts monitoring --strict

eks-monitoring-smoke-prometheus: ## [P9a] Prometheus ready check
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts prometheus

eks-monitoring-smoke-grafana: ## [P9a] Grafana health check
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts grafana

eks-monitoring-smoke-loki: ## [P9a] Loki ready check
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts loki

eks-monitoring-smoke-alertmanager: ## [P9a] Alertmanager health check
	npx tsx $(INFRA_SCRIPTS)/smoke/index.ts alertmanager

# Port Forward (WSL → Bastion → K8s Pod)
eks-monitoring-open: ## [P9a] Port-forward (SVC=grafana|prometheus|alertmanager|loki)
	@if [ -z "$(SVC)" ]; then echo "Usage: make eks-monitoring-open SVC=grafana|prometheus|alertmanager|loki"; exit 1; fi
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts port-forward $(SVC) monitoring

eks-monitoring-grafana: ## [P9a] Grafana UI (localhost:3000, admin/CHANGE_ME)
	$(MAKE) eks-monitoring-open SVC=grafana

eks-monitoring-prometheus: ## [P9a] Prometheus UI (localhost:9090)
	$(MAKE) eks-monitoring-open SVC=prometheus

eks-monitoring-alertmanager: ## [P9a] Alertmanager UI (localhost:9093)
	$(MAKE) eks-monitoring-open SVC=alertmanager

eks-monitoring-loki: ## [P9a] Loki (localhost:3100)
	$(MAKE) eks-monitoring-open SVC=loki

# -----------------------------------------------------------------------------
# Phase 9b: Argo CD
# -----------------------------------------------------------------------------
# デプロイ: eks-argocd-deploy (Helm)
# UI: eks-argocd → localhost:8080
# 認証: eks-argocd-password
# -----------------------------------------------------------------------------

eks-argocd-deploy: ## [P9b] ★Gate Argo CD フルデプロイ (Helm + SSH + Apps)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/argocd.ts deploy

eks-argocd: ## [P9b] Argo CD UI (localhost:8080)
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts port-forward argocd-server argocd

eks-argocd-status: ## [P9b] ApplicationSets / Applications 確認
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/argocd.ts status

eks-argocd-password: ## [P9b] Argo CD admin パスワード取得
	@echo "Admin password:"
	@$(MAKE) eks-bastion-exec CMD="kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath={.data.password} | base64 -d && echo"

eks-argocd-smoke: ## [P9b] Argo CD Smoke Test
	@echo "=== Argo CD Smoke Test ==="
	@echo "--- Pods ---"
	$(MAKE) eks-bastion-kubectl CMD="get pods -n argocd -o wide"
	@echo "--- Services ---"
	$(MAKE) eks-bastion-kubectl CMD="get svc -n argocd"
	@echo "--- Server Health ---"
	$(MAKE) eks-bastion-kubectl CMD="exec -n argocd deploy/argocd-server -- argocd admin dashboard --help >/dev/null 2>&1 && echo 'ArgoCD Server: OK' || echo 'ArgoCD Server: Check required'"

eks-argocd-apps: ## [P9b] ApplicationSet デプロイ (GitOps)
	@echo "=== Deploying ArgoCD ApplicationSets ==="
	$(MAKE) eks-bastion-kubectl CMD="apply -k /home/ec2-user/workspace/infra/k8s/argocd"
	@echo "=== ApplicationSets deployed ==="
	@echo "Check: make eks-argocd-status"

eks-argocd-repo-secret: ## [P9b] Git SSH キー Secret 登録 (冪等)
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/argocd.ts repo-secret

# -----------------------------------------------------------------------------
# Database Port Forward (DBeaver等から接続用)
# -----------------------------------------------------------------------------
# eks-db-rw → localhost:5432 (Primary RW)
# eks-db-ro → localhost:5433 (Replica RO)
# -----------------------------------------------------------------------------

eks-db-rw: ## [DB] PostgreSQL Primary (localhost:5432) - DBeaver接続用
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts port-forward app-postgres-rw database

eks-db-ro: ## [DB] PostgreSQL Replica (localhost:5433) - DBeaver接続用
	npx tsx $(INFRA_SCRIPTS)/tools/bastion/connect.ts port-forward app-postgres-ro database

eks-db-password: ## [DB] appuser パスワード取得
	@echo "appuser password:"
	@$(MAKE) eks-bastion-kubectl CMD="get secret pg-app-user -n database -o jsonpath={.data.password}" 2>/dev/null | base64 -d && echo

# Phase 10: MLOps は mlops.mk を参照

# =============================================================================
# Phase 11: GPU / LLM
# =============================================================================
# GPU 環境構築（vLLM推論）
# 前提: Karpenter インストール済み、AWS GPU上限申請済み
# 手順書: docs/全体/gpu-setup.md
# -----------------------------------------------------------------------------

eks-gpu-deploy: ## [P11] GPU環境デプロイ（全ステップ）
	@echo "=== GPU Environment Deploy (All Steps) ==="
	$(MAKE) eks-gpu-nvidia
	$(MAKE) eks-gpu-nodepool
	$(MAKE) eks-gpu-llm
	$(MAKE) eks-gpu-status

eks-gpu-status: ## [P11] GPU環境ステータス確認
	@echo "=== GPU Environment Status ==="
	@echo "--- Karpenter ---"
	$(MAKE) eks-bastion-kubectl CMD="get pods -n karpenter"
	@echo "--- NodePool / EC2NodeClass ---"
	$(MAKE) eks-bastion-kubectl CMD="get nodepool"
	$(MAKE) eks-bastion-kubectl CMD="get ec2nodeclass"
	@echo "--- NVIDIA Device Plugin ---"
	$(MAKE) eks-bastion-kubectl CMD="get daemonset -n kube-system nvidia-device-plugin-daemonset"
	@echo "--- GPU Nodes ---"
	$(MAKE) eks-bastion-kubectl CMD="get nodes -l workload=gpu"
	@echo "--- LLM Pods ---"
	$(MAKE) eks-bastion-kubectl CMD="get pods -n llm"

eks-gpu-karpenter: ## [P11] Karpenter Helm インストール（未インストール時のみ）
	@echo "=== Karpenter Helm Install ==="
	npx tsx $(INFRA_SCRIPTS)/cli/kubernetes/deploy.ts gpu 1

eks-gpu-nvidia: ## [P11] NVIDIA Device Plugin デプロイ
	@echo "=== NVIDIA Device Plugin Deploy ==="
	$(MAKE) eks-bastion-kubectl CMD="apply -f /home/ec2-user/workspace/infra/k8s/karpenter/nvidia-device-plugin.yaml"

eks-gpu-nodepool: ## [P11] GPU NodePool + EC2NodeClass デプロイ
	@echo "=== GPU NodePool + EC2NodeClass Deploy ==="
	$(MAKE) eks-bastion-kubectl CMD="apply -f /home/ec2-user/workspace/infra/k8s/karpenter/gpu-ec2nodeclass.yaml"
	$(MAKE) eks-bastion-kubectl CMD="apply -f /home/ec2-user/workspace/infra/k8s/karpenter/gpu-nodepool.yaml"

eks-gpu-llm: ## [P11] vLLM Stack デプロイ
	@echo "=== vLLM Stack Deploy ==="
	$(MAKE) eks-bastion-kubectl CMD="apply -k /home/ec2-user/workspace/infra/k8s/llm"
	@echo "--- Waiting for vLLM Pod (this may take several minutes) ---"
	$(MAKE) eks-bastion-kubectl CMD="wait --for=condition=ready pod -l app=llm-inference -n llm --timeout=300s" || echo "Pod not ready yet, check: make eks-gpu-status"

eks-gpu-smoke: ## [P11] GPU Smoke Test
	@echo "=== GPU Smoke Test ==="
	@echo "--- GPU Nodes ---"
	$(MAKE) eks-bastion-kubectl CMD="get nodes -l workload=gpu -o name" || true
	@echo "--- vLLM Pod Status ---"
	$(MAKE) eks-bastion-kubectl CMD="get pods -n llm -l app=llm-inference -o jsonpath='{.items[0].status.phase}'" || true
	@echo ""

eks-gpu-clean: ## [P11] GPU リソースクリーンアップ
	@echo "=== GPU Resources Cleanup ==="
	$(MAKE) eks-bastion-kubectl CMD="delete -k /home/ec2-user/workspace/infra/k8s/llm --ignore-not-found"
	$(MAKE) eks-bastion-kubectl CMD="delete -f /home/ec2-user/workspace/infra/k8s/karpenter/gpu-nodepool.yaml --ignore-not-found"
	$(MAKE) eks-bastion-kubectl CMD="delete -f /home/ec2-user/workspace/infra/k8s/karpenter/gpu-ec2nodeclass.yaml --ignore-not-found"
	@echo "Note: NVIDIA Device Plugin は共有リソースのため削除しません"

# =============================================================================
# 運用・デバッグ
# =============================================================================
# 状態確認・ログ・再起動などの運用コマンド
# -----------------------------------------------------------------------------

eks-k8s-nodes: ## [運用] ノード状態
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts nodes

eks-k8s-events: ## [運用] クラスタイベント
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts events

eks-k8s-logs: ## [運用] アプリログ (hono-app)
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts logs hono-app

eks-k8s-describe: ## [運用] Deployment describe (TARGET=backend|frontend)
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts describe $(TARGET)

eks-k8s-secrets: ## [運用] app-backend-secrets 表示
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts secrets

eks-k8s-restart: ## [運用] Deployment 再起動 (TARGET=backend|frontend|all)
	npx tsx $(INFRA_SCRIPTS)/tools/kubernetes/debug.ts restart $(TARGET)

# =============================================================================
# 削除
# =============================================================================
# 削除時の正しい順序:
#   1. make mlops-clean-all  (MLOps Job/Pod 停止)
#   2. make eks-destroy      (App / EKS 削除)
#   3. make shared-destroy   (Shared 削除)
#
# ★ DBを残したい場合は eks-destroy のオプションに従う
# -----------------------------------------------------------------------------

eks-destroy: ## [削除] EKS 削除 (事前クリーンアップ付き)
	npx tsx $(INFRA_SCRIPTS)/cli/terraform/destroy.ts destroy --force

# shared-destroy は Phase 2 セクションに定義済み

# =============================================================================
# Help (Phase Gate 構成)
# =============================================================================

eks-help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  EKS Production Deployment (Phase Gate 構成)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  ★Gate = 完了条件（次のPhaseに進む前に必ず確認）"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ Phase 0: Prerequisites                                              ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo "  eks-prereq          前提条件チェック (AWS CLI, SSM plugin)"
	@echo "  eks-prereq-install  SSM Plugin インストール"
	@echo "  eks-deploy-all      Phase 1-9 一括デプロイ"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ CONTROL PLANE (Phase 1-3)                                           ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo ""
	@echo "  [Phase 1] AWS認証確認"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-smoke-aws       ★Gate AWS認証 + リージョン確認"
	@echo ""
	@echo "  [Phase 2] Shared + ECR"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  shared-init         Shared Terraform 初期化"
	@echo "  shared-deploy       ★Gate ECR, S3, Firehose 作成"
	@echo "  ecr-login           ECR ログイン (ecr.mk)"
	@echo "  push                ★Gate Frontend + Backend push (ecr.mk)"
	@echo ""
	@echo "  [Phase 3] EKS構築"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-init            EKS Terraform 初期化"
	@echo "  eks-plan            EKS プラン確認"
	@echo "  eks-deploy          EKS クラスタ作成 (15-20分)"
	@echo "  eks-status          ★Gate Terraform状態 (ACTIVE + nodegroup)"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ ACCESS (Phase 4)                                                    ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo ""
	@echo "  [Phase 4] Bastion セットアップ"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-bastion-status  SSM Agent Online 確認"
	@echo "  eks-bastion-setup   kubectl/helm セットアップ"
	@echo "  eks-sync            ワークスペース同期"
	@echo "  eks-k8s-verify      ★Gate kubectl動線確認"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ RUNTIME (Phase 5-9)                                                 ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo ""
	@echo "  [Phase 5] Namespace/SA"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-k8s-init        Namespace + ServiceAccount 作成"
	@echo "  eks-k8s-status      ★Gate namespace/sa 確認"
	@echo "  eks-smoke-eks       Smoke: CloudWatch/VPC Flow Logs"
	@echo ""
	@echo "  [Phase 6] Database"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-db-deploy       CNPG Operator + PostgreSQL"
	@echo "  eks-db-status       ★Gate Primary Ready 確認"
	@echo "  eks-secrets-create  ★Gate app-backend-secrets 作成"
	@echo ""
	@echo "  [Phase 7] App デプロイ (export K8S_OVERLAY=prod)"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-k8s-deploy      ★Gate Frontend + Backend デプロイ"
	@echo "  eks-k8s-status      Pod状態確認 (Running/CrashLoop)"
	@echo "  eks-k8s-health      Health check (curl pod)"
	@echo "  eks-ingress-verify  URL早期確認 (DNS/SSL)"
	@echo ""
	@echo "  [Phase 8] PostDeploy"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-db-migrate      マイグレーション実行"
	@echo "  eks-db-seed         シードデータ投入"
	@echo "  eks-auth-setup      ★Gate AUTH_SERVICE_URL 設定"
	@echo ""
	@echo "  [Phase 9] 最終検証"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-verify          ★Gate Health + Login 検証"
	@echo "  eks-smoke-strict    ★Gate Smoke テスト (CI)"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ WORKLOAD (Phase 9a-10) - Optional                                   ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo ""
	@echo "  [Phase 9a] Monitoring"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-monitoring-deploy   Prometheus/Grafana/Loki デプロイ"
	@echo "  eks-monitoring-status   状態確認"
	@echo "  eks-monitoring-smoke    ★Gate Smoke テスト"
	@echo "  eks-monitoring-grafana  Grafana UI (localhost:3000, admin/CHANGE_ME)"
	@echo ""
	@echo "  [Phase 9b] Argo CD"
	@echo "  ────────────────────────────────────────────────────────────────────"
	@echo "  eks-argocd          Argo CD UI (localhost:8080)"
	@echo "  eks-argocd-status   ApplicationSets 確認"
	@echo "  eks-argocd-password admin パスワード"
	@echo ""
	@echo "  [Phase 10] MLOps → 'make mlops-help' 参照"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ 運用・デバッグ                                                      ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo "  eks-k8s-status      Pod/Service 状態"
	@echo "  eks-k8s-logs        アプリログ"
	@echo "  eks-k8s-describe    Deployment describe"
	@echo "  eks-k8s-restart     Deployment 再起動"
	@echo "  eks-bastion         Bastion SSM接続"
	@echo "  eks-bastion-kubectl kubectl 実行 (CMD='...')"
	@echo ""
	@echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
	@echo "┃ 削除                                                                ┃"
	@echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
	@echo "  1. make mlops-clean-all  (MLOps停止)"
	@echo "  2. make eks-destroy      (EKS削除)"
	@echo "  3. make shared-destroy   (Shared削除)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  失敗時の戻り先ルール"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  DB前で失敗      → Phase 4 (Bastion)"
	@echo "  AppでCrashLoop  → Phase 6 (DB/Secrets)"
	@echo "  Login不可       → Phase 8 (auth setup)"
	@echo "  それでもダメ    → eks-destroy (DBは壊さない原則を優先)"
	@echo ""

