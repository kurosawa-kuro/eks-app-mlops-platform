# EKS MLOps 運用リファレンス

## デプロイ (Phase別)

```bash
# Phase 1: AWS認証確認
make eks-smoke-aws

# Phase 2: Shared + ECR
make shared-init && make shared-deploy
make ecr-login && make push

# Phase 3: EKS
make eks-init && make eks-plan && make eks-deploy
make eks-status

# Phase 4: Bastion
make eks-bastion-status
make eks-bastion-setup && make eks-sync
make eks-k8s-verify

# Phase 5: Namespace/SA
make eks-k8s-init
make eks-smoke-eks

# Phase 6: Database
make eks-db-deploy && make eks-db-status
make eks-secrets-create

# Phase 7: App
export K8S_OVERLAY=prod
make eks-k8s-deploy
make eks-k8s-status && make eks-k8s-health
make eks-ingress-verify

# Phase 8: PostDeploy
make eks-db-migrate && make eks-db-seed
make eks-auth-setup

# Phase 9: 最終検証
make eks-verify
make eks-smoke-strict  # CI枠

# Phase 9a: Monitoring (Optional)
make eks-monitoring-deploy
make eks-monitoring-status && make eks-monitoring-smoke

# Phase 9b: Argo CD (Optional)
make eks-argocd-status

# Phase 10: MLOps
make mlops-build && make mlops-push
make mlops-deploy && make mlops-smoke
make mlops-e2e-analytics
make mlops-verify
```

## 状態確認

```bash
make eks-status              # EKS クラスタ
make eks-k8s-status          # Pod/Service
make eks-db-status           # Database
make mlops-status            # MLOps Jobs
make eks-monitoring-status   # Monitoring
make eks-argocd-status       # ArgoCD
```

## 検証・Smoke Test

```bash
make eks-smoke-aws           # AWS認証
make eks-k8s-verify          # kubectl動線 (Bastion)
make eks-verify              # Health + Login
make eks-smoke-strict        # CI枠 (厳格)
make mlops-smoke             # MLOps IRSA/S3
make eks-monitoring-smoke    # Monitoring
```

## ログ

```bash
make eks-k8s-logs                      # App
make eks-db-logs                       # DB
make mlops-logs STAGE=sentiment        # MLOps
```

## UI アクセス (Port-Forward)

| コマンド | URL | 備考 |
|----------|-----|------|
| `make eks-monitoring-grafana` | http://localhost:3000 | admin / admin |
| `make eks-monitoring-prometheus` | http://localhost:9090 | |
| `make eks-monitoring-alertmanager` | http://localhost:9093 | |
| `make eks-monitoring-loki` | http://localhost:3100 | |
| `make eks-argocd` | http://localhost:8080 | |

```bash
make eks-argocd-password     # ArgoCD admin パスワード
```

## MLOps

```bash
make mlops-e2e-analytics     # E2E実行 (~12分)
make mlops-job JOB=sentiment # 個別実行
make mlops-verify            # S3結果確認
make mlops-metrics           # モデルメトリクス
make mlops-analytics-results # Analytics結果
make mlops-sentiment-results # Sentiment結果
```

**パイプライン依存:**
```
generate ──┐
           ├──→ preprocess ──→ train ──→ analytics
generate-reviews ──────────────────────→ sentiment
```

## Bastion

```bash
make eks-sync                                   # 同期
make eks-bastion-kubectl CMD="get pods -n app"  # kubectl
make eks-bastion-exec CMD="helm list -A"        # 任意コマンド
make eks-bastion                                # インタラクティブ
```

## 復旧

```bash
make eks-k8s-restart                   # 全再起動
make eks-k8s-restart TARGET=backend    # Backend のみ
make eks-db-migrate                    # マイグレーション
make eks-auth-setup                    # AUTH再設定
make eks-secrets-create                # Secrets再作成
```

## 削除

```bash
make mlops-clean-all         # MLOps Jobs
make eks-destroy             # EKS (~10分)
make shared-destroy          # ECR/S3
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| kubectl timeout | `make eks-k8s-*` (Bastion経由で実行) |
| CrashLoopBackOff | `make eks-k8s-describe` → `make eks-k8s-secrets` |
| Login失敗 | `make eks-auth-setup` |
| DB接続エラー | `make eks-db-status` → `make eks-secrets-create` |
| MLOps Failed | `make mlops-logs STAGE=<name>` → `make mlops-info` |
| Ingress 404/502 | `make eks-ingress-verify` → `make eks-k8s-health` |

**戻り先ルール:**
| 失敗状況 | 戻り先 |
|----------|--------|
| DB前で失敗 | Phase 4（Bastion） |
| AppでCrashLoop | Phase 6（DB/Secrets） |
| Login不可 | Phase 8（auth setup） |

---

## 本番URL

| サービス | URL |
|----------|-----|
| Frontend | https://app.tk-k8s.com |
| API | https://api.tk-k8s.com |
| Health | https://api.tk-k8s.com/health |

---

## テストユーザー

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | (see .env) | admin |
| admin-readonly@example.com | (see .env) | admin-read-only |
| user1@example.com | (see .env) | user |
| user2@example.com | (see .env) | user |

---

## コマンド命名規則

| サフィックス | 用途 |
|-------------|------|
| `*-status` | 状態表示（破壊しない） |
| `*-verify` | 合否判定（exit codeで落ちる） |
| `*-smoke` | 軽量E2E |
| `*-smoke-strict` | CI/再現性向け |
