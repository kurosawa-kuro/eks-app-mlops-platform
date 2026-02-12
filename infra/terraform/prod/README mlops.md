# EKS MLOps App-API 連携疎通ガイド

## 概要

EKS上でMLOpsパイプラインとHono APIが連携する構成。MLOpsジョブがS3に分析結果を出力し、Hono APIがそれを読み取ってエンドポイントとして公開する。

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  MLOps Jobs     │────▶│      S3         │────▶│   Hono API      │
│  (EKS/mlops)    │     │   analytics/    │     │  (EKS/app)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        └──────────── IRSA (IAM Role) ─────────────────┘
```

## 前提条件

### 1. IRSA (IAM Roles for Service Accounts) 設定

**Terraform (80_iam.tf)**
```hcl
module "irsa_workload" {
  # ...
  oidc_providers = {
    main = {
      provider_arn = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = [
        "app:hono-serviceaccount",      # Hono API用
        "default:etl-serviceaccount",
        "mlops:mlops-sa"                # MLOpsジョブ用
      ]
    }
  }
}
```

**Kubernetes ServiceAccount (infra/k8s/base/serviceaccount.yaml)**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hono-serviceaccount
  namespace: app
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<AWS_ACCOUNT_ID>:role/k8s-ml-platform-prod-workload-role
```

### 2. S3パス構成

| パス | 説明 | 生成元 |
|------|------|--------|
| `raw/reviews.csv` | 入力レビューデータ | generate-reviewsジョブ |
| `analytics/analytics_latest.json` | 売上分析結果 | analyticsジョブ |
| `analytics/sentiment_results.json` | 感情分析結果 | sentimentジョブ |

## デプロイ手順

### Step 1: インフラ準備

```bash
cd scripts

# Terraform apply (IAM変更反映)
terraform -chdir=terraform/prod apply

# Hono APIデプロイ
node k8s-app-deploy.js
```

### Step 2: MLOpsベースリソースデプロイ

```bash
# namespace, configmap, serviceaccount作成
node k8s-mlops-deploy.js --mlops
```

### Step 3: データ準備 (初回のみ)

```bash
# レビューデータ生成
node k8s-mlops-deploy.js --mlops --job generate-reviews --deploy-only --wait
```

### Step 4: 分析ジョブ実行

```bash
# 感情分析
node k8s-mlops-deploy.js --mlops --job sentiment --deploy-only --wait

# 売上分析
node k8s-mlops-deploy.js --mlops --job analytics --deploy-only --wait
```

## API エンドポイント

### 疎通確認

```bash
# ヘルスチェック
curl https://api.tk-k8s.com/health

# 感情分析結果
curl https://api.tk-k8s.com/internal/analytics/sentiment | jq '.data.summary'

# 売上分析結果
curl https://api.tk-k8s.com/internal/analytics | jq '.data.summary'

# 統合データ
curl https://api.tk-k8s.com/internal/analytics/combined | jq '.data'
```

### レスポンス例

**感情分析 (/internal/analytics/sentiment)**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-12-13T06:24:27.643751",
    "model": "jarvisx17/japanese-sentiment-analysis",
    "total_reviews": 100,
    "summary": {
      "positive": 54,
      "negative": 46,
      "neutral": 0
    }
  },
  "cachedAt": "2025-12-13T06:32:31.656Z"
}
```

## トラブルシューティング

### 404 File not found

**原因**: S3にファイルが存在しない

```bash
# S3ファイル確認
aws s3 ls s3://k8s-ml-platform-prod-data-<AWS_ACCOUNT_ID>/analytics/

# 必要なジョブを実行
node k8s-mlops-deploy.js --mlops --job sentiment --deploy-only --wait
```

### 503 Analytics API not enabled

**原因**: 環境変数 `S3_BUCKET` が未設定

```bash
# Pod環境変数確認 (Bastion経由)
kubectl describe pod -n app -l app=hono-app | grep S3_BUCKET
```

### ジョブ失敗 (NoSuchKey)

**原因**: 依存データが存在しない

```bash
# sentimentジョブはreviews.csvが必要
# 先にgenerate-reviewsを実行
node k8s-mlops-deploy.js --mlops --job generate-reviews --deploy-only --wait
```

### Podイメージ更新が反映されない

**原因**: rollout restartが必要

```bash
# Bastion経由で再起動
aws ssm send-command --instance-ids <BASTION_INSTANCE_ID> \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo -u ec2-user bash -c '\''aws eks update-kubeconfig --region ap-northeast-1 --name prod-eks-cluster && kubectl rollout restart deployment/hono-app -n app'\''"]'
```

## ファイルパス対応表

| コンポーネント | ファイル | 設定箇所 |
|----------------|----------|----------|
| MLOps ConfigMap | `mlops/k8s/configmap.yaml` | S3_SENTIMENT_PATH |
| Hono API | `apps/monolith/src/services/AnalyticsService.ts:117` | getSentiment() |
| デプロイスクリプト | `scripts/k8s-mlops-deploy.js` | SSM経由実行 |

## 関連コミット

- `bffcc30` - feat: add IRSA ServiceAccount for hono-app with KMS access
- `7a8e233` - fix: correct S3 path for sentiment results in AnalyticsService
