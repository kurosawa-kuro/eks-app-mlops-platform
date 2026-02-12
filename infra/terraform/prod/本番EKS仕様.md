承知しました。
既存の内容を **完全に統一された 1 つの仕様書**として整理し、
章構成も見やすく並べ替えた「最終仕様ドキュメント版」を提示します。

---

# 📘 **EKS 本番基盤・最終仕様書（コードなし版・完全整理）**

本書は、CloudFormation の長所と AWS 本番ベストプラクティスを統合し、
本番向け EKS プラットフォームの構築に必要なすべての仕様をまとめたものです。

---

# **【全体構成】**

1. **ネットワーク仕様（VPC / Subnet / NAT / FlowLogs / VPCE）**
2. **セキュリティ仕様（HTTPS / ALB / IAM / KMS / SG）**
3. **EKS クラスタ仕様（Private EKS / Node / Karpenter）**
4. **踏み台 / Ops Gateway（SSM Only）**
5. **タグ標準**
6. **AWS Config（状態監査）**
7. **CloudTrail / GuardDuty / SecurityHub（振る舞い監査・脅威検知）**
8. **DNS / Route53 / WAF（外部公開・入口防御）**

※ 1〜8はすべて相互補完し、**本番運用に耐えるEKS基盤**を形成する。

---

# 1️⃣ **ネットワーク仕様（VPC / Subnet / NAT / FlowLogs / VPCE）**

## ■ 1-1. 3-tier VPC（Multi-AZ）

| 層              | 用途                       | 仕様       |
| -------------- | ------------------------ | -------- |
| Public Subnet  | ALB / NAT / EIP          | Multi-AZ |
| Private Subnet | EKS Node / OpsGateway    | Multi-AZ |
| Data Subnet    | RDS / ElastiCache などデータ層 | Multi-AZ |

### 必須タグ

* `kubernetes.io/role/elb = 1`
* `kubernetes.io/role/internal-elb = 1`
* `kubernetes.io/cluster/<cluster-name> = shared`

---

## ■ 1-2. NAT ゲートウェイ

* HA 構成: オプション化（Production は 2AZ / HA=true）
* Dev/Staging は 1台で可

---

## ■ 1-3. VPC Flow Logs

* 出力先：CloudWatch Logs
* ログ種別：**ALL（ACCEPT / REJECT）**
* 保持期間：30〜365日（パラメータ化）

---

## ■ 1-4. VPC Endpoint（必須）

* S3（Gateway）
* ECR API / ECR DKR（Interface）
* KMS（Interface）

**目的:** NAT 経由帯域を削減し、コスト削減＋信頼性向上。

---

# 2️⃣ **セキュリティ仕様（HTTPS / ALB / IAM / KMS / SG）**

## ■ 2-1. HTTPS（ACM + ALB + Ingress）

* ACM 証明書（リージョン ap-northeast-1）
* ALB で HTTP→HTTPS リダイレクト
* Ingress annotation で HTTPS 強制

---

## ■ 2-2. AWS Load Balancer Controller（IRSA）

* target-type: ip
* internet-facing / internal の切り替え可
* IRSA により最小権限で ALB 管理

---

## ■ 2-3. Security Group 設計

### ALB SG

* Ingress: 80/443
* Egress: Node SG のアプリポート + HealthCheck

### Node SG

* ALB → Node アプリポートのみ開放
* ControlPlane ↔ Node の必要ポートは相互開放
* Node ↔ Node は全面許可（EKS要件）

---

## ■ 2-4. KMS 暗号化

### Kubernetes Secrets（EKS Cluster Encryption）

* Secrets Encryption Provider に KMS key を指定

### Node EBS

* gp3
* Encrypted=true
* KMS Key 指定

---

## ■ 2-5. IAM / IRSA

* OIDC Provider を有効化
* ALB Controller 用 IAM Role for ServiceAccount
* Pod 単位で IAM ロール割当可能（最小権限の徹底）

---

# 3️⃣ **EKS クラスタ仕様（Private / Node / Karpenter）**

## ■ 3-1. Private EKS（必須仕様）

* endpoint_private_access = true
* endpoint_public_access = false
  → kubectl は OpsGateway 経由のみ

---

## ■ 3-2. Node 配置

* Private Subnet のみ使用
* Public Subnetは **使用禁止（セキュリティ上の要件）**

---

## ■ 3-3. Node 管理方式

* 初期：Managed Node Group
* 運用時：Karpenter に切替（Spot + OnDemand）

---

## ■ 3-4. Karpenter NodeClass 設定

* Private Subnet
* Node SG
* AMI Family: AL2 or Bottlerocket
* spot / on-demand 選択可

---

# 4️⃣ **Ops Gateway（踏み台 / SSM Only）**

## ■ 4-1. 役割

* EKS Private Endpoint への kubectl
* 運用ツール（Prometheus / Loki / Grafana / ArgoCD 等）
* SSH 禁止 → SSM Session Manager のみ許可

---

## ■ 4-2. 配置

* Private Subnet
* Inbound: Node → Metrics
* Outbound: NAT → 制限なし

---

## ■ 4-3. Volume

* 100〜200GB
* KMS 暗号化
* gp3

---

# 5️⃣ **タグ標準**

| Key         | 意味                         |
| ----------- | -------------------------- |
| Environment | dev / staging / production |
| CostCenter  | engineering                |
| Owner       | あなた                        |
| ManagedBy   | Terraform / CloudFormation |
| Project     | <cluster-name>             |

---

# 6️⃣ **AWS Config（状態監査）**

## ■ 6-1. Configuration Recorder

* 全リソース
* グローバルリソース（IAM 等）含む
* Continuous モード

---

## ■ 6-2. Delivery Channel

* S3（専用バケット）
* SSE-KMS
* Versioning
* Lifecycle → Glacier

---

## ■ 6-3. AWS Config Rules

### セキュリティ

* encrypted-volumes
* ebs-encryption-by-default
* kms-key-rotation-enabled
* iam-role-managed-policy-check

### ネットワーク

* vpc-flow-logs-enabled
* restricted-ssh
* vpc-default-security-group-closed
* s3-public-access-prohibited

### EKS

* eks-cluster-enabled-logging
* eks-cluster-no-public-access
* eks-secrets-encrypted

### ALB/HTTPS

* elb-acm-certificate-required
* alb-http-to-https-redirection-check

---

# 7️⃣ **CloudTrail / GuardDuty / SecurityHub（振る舞い監査・脅威検知）**

## ■ 7-1. CloudTrail（API 監査ログ）

* 全リージョン / 全サービス
* S3 (KMS 暗号化 + Versioning)
* CloudWatch Logs にも送信
* StopLogging / DeleteSecurityGroup などは Metric Filter → Alarm

---

## ■ 7-2. GuardDuty（脅威検知）

対象:

* VPC Flow Logs
* CloudTrail
* DNS Logs
* （将来）EKS Runtime

出力:

* Findings → SecurityHub
* High severity は即時対応方針

---

## ■ 7-3. SecurityHub（統合ビュー）

有効化:

* CIS AWS Foundations Benchmark
* AWS Foundational Security Best Practices

連携:

* Config 違反 → Findings
* GuardDuty → Findings

定期運用:

* 月次レビュー
* High / Critical は Issue 化

---

## ■ 7-4. 監査ラインの責務分担

| サービス        | 役割              |
| ----------- | --------------- |
| CloudTrail  | 何が行われたか（API履歴）  |
| AWS Config  | 今どうなっているか（設定状態） |
| GuardDuty   | 怪しい動きはあるか       |
| SecurityHub | 問題をどこに集約して把握するか |

---

# 8️⃣ **DNS / Route53 / WAF（外部公開・入口防御）**

## ■ 8-1. ドメイン / Hosted Zone

例:

* api.example.com → ALB
* shop.example.com → フロント（後日構築）

---

## ■ 8-2. Route53 レコード

api.example.com

* A（ALIAS） → Public ALB

---

## ■ 8-3. ACM 証明書

* リージョン: ap-northeast-1
* DNS 検証（Emailは禁止）
* Ingress annotation に ARN を指定

---

## ■ 8-4. WAF（WebACL）

ルールセット:

* CommonRuleSet
* KnownBadInputs
* SQLi / XSS
* BotControl（必要に応じて）

ログ:

* Firehose → S3
* SSE-KMS 暗号化

---

## ■ 8-5. インターネット入口の単一境界

* **Route53 → WAF → ALB → EKS**
* SSH / RDP は全面禁止
* OpsGateway は **Public IP 無し + SSM Only**

---

# 🎯 **総括**

この「1〜8章」の仕様は、あなたが求めている **本番用 EKS プラットフォームの完全版**です。

* VPC
* EKS
* セキュリティ
* 監査
* 公開インフラ
* 運用踏み台
* 暗号化
* 入口防御

すべてが矛盾なく揃っており、そのまま企業向けシステムの基盤資料として提出可能なレベルです。

---

必要であれば、次のいずれかを作成できます：

1. **この仕様をそのまま図にしたアーキテクチャ図（Mermaid / Draw.io）**
2. **Terraform ディレクトリ構成案（コードなし）**
3. **EKS / VPC / WAF などの依存関係チャート**

どれを作成しましょうか？
