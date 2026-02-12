# Production EKS Infrastructure

Private EKS クラスタの Terraform 構成。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        VPC                                 │  │
│  │  ┌─────────────────┐    ┌─────────────────┐               │  │
│  │  │  Public Subnet  │    │  Public Subnet  │               │  │
│  │  │   (AZ-a)        │    │   (AZ-c)        │               │  │
│  │  │  NAT Gateway    │    │                 │               │  │
│  │  └────────┬────────┘    └─────────────────┘               │  │
│  │           │                                                │  │
│  │  ┌────────┴────────┐    ┌─────────────────┐               │  │
│  │  │ Private Subnet  │    │ Private Subnet  │               │  │
│  │  │   (AZ-a)        │    │   (AZ-c)        │               │  │
│  │  │                 │    │                 │               │  │
│  │  │  ┌──────────┐   │    │  ┌──────────┐   │               │  │
│  │  │  │ Bastion  │   │    │  │ EKS Node │   │               │  │
│  │  │  │ (SSM)    │   │    │  │          │   │               │  │
│  │  │  └──────────┘   │    │  └──────────┘   │               │  │
│  │  │                 │    │                 │               │  │
│  │  │  ┌──────────┐   │    │  ┌──────────┐   │               │  │
│  │  │  │ EKS Node │   │    │  │ EKS API  │   │               │  │
│  │  │  │          │   │    │  │(Private) │   │               │  │
│  │  │  └──────────┘   │    │  └──────────┘   │               │  │
│  │  └─────────────────┘    └─────────────────┘               │  │
│  │                                                            │  │
│  │  VPC Endpoints: SSM, ECR, S3, KMS, Logs, STS              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## クイックスタート

```bash
# 構築（推奨: 監視スクリプト使用）
make provision          # Terraform Apply + 全フェーズ監視

# デプロイ
make deploy             # S3 -> Bastion -> kubectl apply

# ヘルスチェック
make health             # Bastion 上で実行するコマンド表示

# Bastion 接続
make bastion            # SSM Session Manager で接続

# 削除（推奨: クリーンアップスクリプト使用）
make destroy-full       # 依存リソース削除 + Terraform Destroy
```

## ファイル構成

```
prod/
├── main.tf                # Terraform 設定, プロバイダー
├── vpc.tf                 # VPC, Flow Logs, VPC Endpoints
├── eks.tf                 # EKS クラスタ, IRSA
├── bastion.tf             # Bastion (SSM), SSM Document
├── iam.tf                 # Bastion IAM
├── security_groups.tf     # VPC Endpoints, ALB, Bastion SG
├── karpenter.tf           # Karpenter (オートスケーラー)
├── helm.tf                # AWS LB Controller
├── ecr.tf                 # ECR データソース
├── s3.tf                  # MLOps データバケット
├── kms.tf                 # 暗号化キー
├── logging.tf             # CloudWatch Logs, Firehose
├── outputs.tf             # 出力値
├── variables.tf           # 変数定義, ローカル値
├── (scripts は ../../scripts/ に移動)
│   # scripts/infra/tf-provision.js    - ★ Terraform インフラ構築 + 全フェーズ監視
│   # scripts/infra/k8s-deploy.js      - ★ Bastion 経由 K8s デプロイ
│   # scripts/infra/tf-destroy.js      - ★ Terraform クリーンアップ + Destroy
├── TROUBLESHOOTING.md     # トラブルシューティング
└── Makefile               # コマンドショートカット
```

## インフラ構成

| コンポーネント | 設定 |
|--------------|------|
| EKS バージョン | 1.29 |
| ノード | t3.medium x 2 (Managed Node Group) |
| Endpoint | Private Only |
| 暗号化 | EBS: KMS, Secrets: KMS |
| ログ | CloudWatch Logs (VPC Flow, アプリ) |
| Bastion | t3.small, SSM Only (SSH 無効) |

## 運用ワークフロー

### 1. インフラ構築 (`make provision`)

`tf-provision.js` は Terraform Apply 後に全フェーズを自動監視:

```
Phase 1: Pre-flight Checks     - AWS CLI, Credentials, Terraform 初期化
Phase 2: Terraform Apply       - インフラ構築 (15-20分)
Phase 3: Cluster ACTIVE        - EKS クラスタ状態監視 (20s間隔)
Phase 4: NodeGroup ACTIVE      - NodeGroup 状態監視 (20s間隔)
Phase 5: ASG Instance READY    - EC2 インスタンス起動監視 (20s間隔)
Phase 6: Bastion SSM Online    - Bastion SSM 接続確認 (15s間隔)
Phase 7: Kubernetes Config     - (Private EKS: スキップ)
```

```bash
# 推奨: フル構築
make provision

# Apply スキップ（監視のみ、既存クラスタ確認用）
make provision-skip-apply

# タイムアウト変更
make provision-timeout T=900
```

### 2. アプリデプロイ (`make deploy`)

`k8s-deploy.js` は S3 経由で Bastion から kubectl apply:

```
Phase 1: Pre-flight Checks     - AWS CLI, Terraform outputs, マニフェスト
Phase 2: Upload to S3          - K8s マニフェストを S3 にアップロード
Phase 3: Bastion SSM Check     - Bastion が SSM Online か確認
Phase 4: Deploy via SSM        - Bastion で kubectl apply 実行
```

```bash
# 推奨: フルデプロイ
make deploy

# ドライラン（実際に適用しない）
make deploy-dry

# S3 アップロードのみ
make upload

# オプション付き実行
node ../../scripts/k8s-app-deploy.js --skip-upload    # S3 スキップ
node ../../scripts/k8s-app-deploy.js --overlay staging # overlay 変更
```

### 3. インフラ削除 (`make destroy-full`)

`tf-destroy.js` は依存リソースを先に削除してから Terraform Destroy:

```
Phase 1: Pre-flight Checks     - AWS CLI, Terraform state
Phase 2: K8s Cleanup           - (Private EKS: Bastion 上で手動)
Phase 3: Node Group Deletion   - EKS NodeGroup 削除
Phase 4: VPC Endpoint Cleanup  - Interface Endpoints 削除
Phase 5: NAT Gateway Cleanup   - NAT Gateway 削除
Phase 6: ENI Cleanup           - 孤立 ENI 削除
Phase 7: S3 Bucket Cleanup     - バケット内オブジェクト削除
Phase 8: Terraform Destroy     - 最終削除
```

```bash
# 推奨: フル削除
make destroy-full

# ドライラン（削除対象確認）
make destroy-dry

# K8s クリーンアップスキップ
make destroy-skip-k8s

# 確認プロンプトなし（危険）
make destroy-force
```

## その他のコマンド

### Terraform (低レベル)

```bash
make init      # terraform init
make plan      # terraform plan
make apply     # terraform apply (監視なし、非推奨)
make fmt       # terraform fmt
make validate  # terraform validate
make output    # terraform output
```

### Bastion 接続

```bash
# SSM Session Manager で接続
make bastion

# または直接
aws ssm start-session --target $(terraform output -raw bastion_instance_id) --region ap-northeast-1
```

### ヘルスチェック (Bastion 上で実行)

```bash
# Pod 状態確認
kubectl get pods -n app -o wide

# Service 確認
kubectl get svc -n app

# ヘルスチェック API
kubectl exec -n app $(kubectl get pods -n app -l app=hono-app -o jsonpath='{.items[0].metadata.name}') -- wget -qO- http://localhost:8000/health

# リアルタイムログ監視
kubectl logs -n app -l app=hono-app -f

# イベント確認
kubectl get events -n app --sort-by=.lastTimestamp | tail -20
```

## トラブルシューティング

詳細は [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) を参照。

### よくある問題

| 問題 | 原因 | 対処 |
|-----|------|------|
| SSM 接続不可 | Minimal AMI | AMI フィルタを `al2023-ami-2023.*` に |
| kubectl タイムアウト | SG 設定漏れ | Bastion → EKS API (443) を許可 |
| S3 AccessDenied | IAM 権限不足 | bastion_eks ポリシーに S3/KMS 追加 |
| Terraform Destroy ハング | 依存リソース残存 | `make destroy-full` で事前クリーンアップ |

## コスト最適化

- NAT Gateway: 1つのみ（AZ-a）
- EKS: Managed Node Group（Karpenter でスケール）
- Bastion: t3.small（常時稼働）

## セキュリティ

- EKS Endpoint: Private Only
- SSH: 完全無効（SSM Session Manager のみ）
- EBS: KMS 暗号化
- Secrets: KMS 暗号化
- IMDSv2: 必須
- VPC Flow Logs: 有効
