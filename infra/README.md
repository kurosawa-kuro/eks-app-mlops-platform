# Infrastructure Scripts

EKS/AWS インフラストラクチャ管理スクリプト集

## Quick Start

```bash
# EKSデプロイ
make app                    # Honoアプリをデプロイ
make mlops                  # MLOpsリソースをデプロイ
make gpu-all                # GPU/LLMインフラをデプロイ
make status                 # 全体ステータス確認
```

## Scripts

| スクリプト | 用途 |
|-----------|------|
| `k8s-deploy.js` | EKS統合デプロイ (app/mlops/gpu) |
| `tf-provision.js` | Terraformプロビジョニング |
| `tf-destroy.js` | Terraform削除 (安全確認付き) |
| `ecr-manage.js` | ECRリポジトリ管理 |
| `s3-manage.js` | S3バケット管理 |
| `firehose-manage.js` | Kinesis Data Firehose管理 |
| `secrets-manage.js` | AWS Secrets Manager管理 |
| `lib.js` | 共通ユーティリティ |

## k8s-deploy.js

統合デプロイスクリプト。3つのモードをサポート。

### App Mode

```bash
node scripts/infra/k8s-deploy.js app                    # 基本デプロイ
node scripts/infra/k8s-deploy.js app --setup-alb        # ALB Controller付き
node scripts/infra/k8s-deploy.js app --dry-run          # dry-run
node scripts/infra/k8s-deploy.js app --overlay staging  # stagingオーバーレイ
```

### MLOps Mode

```bash
node scripts/infra/k8s-deploy.js mlops                       # ベースリソース
node scripts/infra/k8s-deploy.js mlops --job analytics       # ジョブ実行
node scripts/infra/k8s-deploy.js mlops --job sentiment --wait  # 完了待機
node scripts/infra/k8s-deploy.js mlops --job train --deploy-only  # ジョブのみ
```

有効なジョブ: `preprocess`, `train`, `analytics`, `sentiment`, `generate`, `generate-reviews`

### GPU Mode

```bash
node scripts/infra/k8s-deploy.js gpu all      # 全ステップ実行
node scripts/infra/k8s-deploy.js gpu 1        # Karpenterインストール
node scripts/infra/k8s-deploy.js gpu 2        # NVIDIA Device Plugin
node scripts/infra/k8s-deploy.js gpu 3        # GPU NodePool
node scripts/infra/k8s-deploy.js gpu 4        # LLM Stack (vLLM)
node scripts/infra/k8s-deploy.js gpu 5        # Hono再デプロイ
node scripts/infra/k8s-deploy.js gpu status   # 状態確認
```

### Status

```bash
node scripts/infra/k8s-deploy.js status       # 全体ステータス
```

## Terraform Scripts

```bash
# プロビジョニング
node scripts/infra/tf-provision.js            # 対話的にリソース選択
node scripts/infra/tf-provision.js --all      # 全リソース

# 削除
node scripts/infra/tf-destroy.js              # 対話的に削除
node scripts/infra/tf-destroy.js --force      # 確認スキップ
```

## AWS Resource Scripts

```bash
# ECR
node scripts/infra/ecr-manage.js login        # Docker login
node scripts/infra/ecr-manage.js list         # リポジトリ一覧
node scripts/infra/ecr-manage.js create <name>  # 新規作成

# S3
node scripts/infra/s3-manage.js list          # バケット一覧
node scripts/infra/s3-manage.js show <bucket> # 詳細表示
node scripts/infra/s3-manage.js setup <bucket>  # サンプル付き作成

# Firehose
node scripts/infra/firehose-manage.js list              # ストリーム一覧
node scripts/infra/firehose-manage.js show <stream>     # 詳細表示
node scripts/infra/firehose-manage.js create <stream> <bucket>  # 新規作成 (S3宛先)
node scripts/infra/firehose-manage.js status <stream>   # ステータス確認
node scripts/infra/firehose-manage.js test <stream>     # テストレコード送信

# Secrets
node scripts/infra/secrets-manage.js list     # シークレット一覧
node scripts/infra/secrets-manage.js show <name>  # 詳細表示
node scripts/infra/secrets-manage.js create <name>  # 新規作成
```

## Directory Structure

```
infra/
├── scripts/           # 管理スクリプト
│   ├── k8s-deploy.js  # EKS統合デプロイ
│   ├── lib.js         # 共通ライブラリ
│   └── ...
├── k8s/               # Kubernetes manifests
│   ├── base/          # ベースマニフェスト
│   └── overlays/      # 環境別オーバーレイ
│       ├── local/
│       ├── staging/
│       └── prod/
└── terraform/         # Terraform設定
    └── prod/
```

## Environment Variables

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `AWS_REGION` | `ap-northeast-1` | AWSリージョン |
| `AWS_PROFILE` | - | AWSプロファイル |
