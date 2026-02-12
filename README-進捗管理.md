# PROJECT_STATUS — eks-app-mlops-platform（Kind / EKS 分離版）

> 更新: 2026-02-12
> 目的: 本プロジェクトの **機能・工程・環境別進捗（Kind / EKS）** を即時把握する

---

## 表記ルール

* **Kind** = ローカル Kubernetes 検証環境
* **EKS** = 本番 Kubernetes 環境
* 状態:

  * ✅ 完了
  * ⏳ 未
  * — 対象外

---

## 全体ステータス

| コンポーネント | ステータス | 主要技術 |
|---------------|-----------|---------|
| Backend (Hono) | **完了** | TypeScript, Prisma, AWS SDK |
| Frontend (Next.js) | **完了** | React 19, Zustand, Tailwind v4 |
| Auth Service | **完了** | JWT, Cognito, RBAC |
| MLOps Pipeline | **完了** | Python, DuckDB, Transformers |
| EKS Infrastructure | **完了** | Terraform, VPC, EKS |
| K8s Manifests | **完了** | Kustomize, CNPG, Monitoring |
| Monitoring Stack | **完了** | Prometheus, Grafana, Loki |
| ArgoCD (GitOps) | **完了** | ApplicationSet x 3 |
| Infra Scripts (DDD) | **完了** | TypeScript, Vitest, Awilix DI |
| AWS Resource Monitor | **完了** | Hono, DDD, 20+ AWS Adapters |

---

## A. アプリケーション（EC / API）

| サブ機能             | 内容                                    | 工程 | Kind | EKS |
| ---------------- | ------------------------------------- | -- | ---- | --- |
| 認証               | Cookie httpOnly / login / logout / me | 実装 | ✅    | ✅   |
| 認可               | RBAC（admin限定）                         | 実装 | ✅    | ✅   |
| EC Shop          | 商品・カート・注文                              | 実装 | ✅    | ✅   |
| EC Shop          | 商品画像                                  | ⏳ | ⏳    | ⏳   |
| EC Shop          | 全体的なスタイル修正                            | ⏳ | ⏳    | ⏳   |
| EC Shop          | 分析に向いたDBテーブル設計                        | ⏳ | ⏳    | ⏳   |
| Admin UI         | Analytics / Audit / LLM               | 実装 | ✅    | ⏳   |
| Audit            | 監査ログ取得                                | 実装 | ✅    | ⏳   |
| Analytics API    | S3 読み取り                               | 実装 | ✅    | ⏳   |
| LLM Proxy API    | chat / embeddings                     | 実装 | ✅    | ⏳   |
| Health / Metrics | `/health` `/metrics`                  | 実装 | ✅    | ✅   |
| E2E              | Playwright                            | 検証 | ✅    | —   |

---

## B. フロントエンド（Next.js 16）

| サブ機能     | 内容                      | 工程 | Kind | EKS |
| -------- | ----------------------- | -- | ---- | --- |
| 認証画面     | `/login`                | 実装 | ✅    | ✅   |
| ダッシュボード  | `/dashboard`            | 実装 | ✅    | ✅   |
| EC 画面    | 商品・カート・注文               | 実装 | ✅    | ✅   |
| 管理画面     | Analytics / Audit / LLM | 実装 | ✅    | ⏳   |
| Zustand  | 状態管理                    | 実装 | ✅    | ✅   |
| UI 部品    | Button / Chart 等        | 実装 | ✅    | ✅   |
| SSR      | ECshop                  | 実装 | ✅    | ✅   |
| HTTPS 公開 | ALB 経由                  | 配置 | —    | ✅   |

---

## C. バックエンド（Hono）

| サブ機能          | 内容                    | 工程 | Kind | EKS |
| ------------- | --------------------- | -- | ---- | --- |
| Auth API      | `/api/auth/*`         | 実装 | ✅    | ✅   |
| Shop API      | `/api/shop/*`         | 実装 | ✅    | ✅   |
| Audit API     | admin 限定              | 実装 | ✅    | ⏳   |
| Analytics API | `/internal/analytics` | 実装 | ✅    | ⏳   |
| LLM API       | `/internal/llm/*`     | 実装 | ✅    | ⏳   |
| DevTool       | EJS 維持                | 実装 | ✅    | ✅   |
| Cookie/CORS   | local / kind          | 設定 | ✅    | ✅   |

---

## D. インフラ / Kubernetes

| サブ機能        | 内容                   | 工程 | Kind | EKS |
| ----------- | -------------------- | -- | ---- | --- |
| VPC         | 3層 / Private         | 構築 | —    | ✅   |
| EKS         | Managed Cluster      | 構築 | —    | ✅   |
| Karpenter   | Node 管理              | 構築 | —    | ✅   |
| ALB / HTTPS | Route53 / ACM        | 構築 | —    | ✅   |
| FE/BE 分離    | Deployment / Service | 設計 | ✅    | ✅   |
| Kustomize   | env 分離               | 設計 | ✅    | ✅   |
| Kind 検証     | dev-cluster          | 検証 | ✅    | —   |
| 本番 Apply    | prod overlay         | 配置 | —    | ✅   |

---

## E. データベース

| サブ機能            | 内容                  | 工程 | Kind | EKS |
| --------------- | ------------------- | -- | ---- | --- |
| Prisma          | schema / migration  | 実装 | ✅    | ✅   |
| Neon            | 開発用 DB              | 検証 | ✅    | —   |
| CNPG Operator   | PostgreSQL Operator | 検証 | ✅    | ✅   |
| CNPG Cluster    | HA（3 instances）     | 検証 | ✅    | ✅   |
| ExternalSecrets | AWS Secrets         | 設計 | ✅    | ✅   |
| 本番 DB           | CNPG on EKS         | 配置 | —    | ✅   |

---

## F. GitOps / 運用

| サブ機能           | 内容               | 工程 | Kind | EKS |
| -------------- | ---------------- | -- | ---- | --- |
| Argo CD        | GitOps 基盤        | 構築 | ✅    | ✅   |
| SSH 認証         | Private Repo     | 構築 | ✅    | ✅   |
| ApplicationSet | env 別生成          | 設計 | ✅    | ✅   |
| SyncPolicy     | prune / selfHeal | 設定 | ✅    | ✅   |
| Argo UI        | Port-Forward運用   | 配置 | —    | ✅   |

---

## G. Observability

| サブ機能              | 内容              | 工程 | Kind | EKS |
| ----------------- | --------------- | -- | ---- | --- |
| Prometheus        | Metrics         | 検証 | ✅    | ✅   |
| Grafana           | Dashboards      | 検証 | ✅    | ✅   |
| Loki              | Logs            | 検証 | ✅    | ✅   |
| Promtail          | Log Agent       | 検証 | ✅    | ✅   |
| Alertmanager      | Alerts          | 設計 | ✅    | ✅   |
| Node-exporter     | Node Metrics    | 検証 | ✅    | ✅   |
| Kube-state-metrics| K8s Metrics     | 検証 | ✅    | ✅   |
| Port-Forward      | WSL→Bastion→Pod | 検証 | —    | ✅   |
| Smoke Test        | 機能検証            | 検証 | —    | ✅   |
| Recording Rules   | 集約指標            | 実装 | ✅    | ✅   |

---

## H. MLOps / LLM

| サブ機能               | 内容                       | 工程 | Kind | EKS |
| ------------------ | ------------------------ | -- | ---- | --- |
| MLOps Pipeline     | 7-stage (smoke含む)        | 実装 | ✅    | ✅   |
| Argo Workflows     | ワークフローオーケストレーション        | 構築 | ⏳    | ⏳   |
| dbt                | データ変換（ELT）              | 実装 | ⏳    | ⏳   |
| S3                 | raw / processed / models | 構築 | ✅    | ✅   |
| Analytics 出力       | S3 JSON (DuckDB)         | 実装 | ✅    | ✅   |
| DuckDB Adapter     | インメモリ分析                  | 実装 | ✅    | ✅   |
| Snowflake Adapter  | クラウド分析                   | 実装 | ✅    | ⏳   |
| Snowflake Secret   | 認証情報管理                   | 設計 | —    | ⏳   |
| GPU NodePool       | g5 / g6 Spot + On-Demand | 構築 | —    | ✅   |
| GPU EC2NodeClass   | al2@latest               | 構築 | —    | ✅   |
| NVIDIA Plugin      | DaemonSet                | 配置 | —    | ✅   |
| vLLM               | Qwen2.5-1.5B 推論          | 配置 | —    | ✅   |
| TEI Embeddings     | multilingual-e5-small    | 配置 | —    | ✅   |
| 感情分析バッチ           | 日本語BERT                  | 実装 | ✅    | ✅   |
| 感情分析ダッシュボード       | 基本UI                     | 実装 | ✅    | ⏳   |
| 感情分析リアルタイムAPI     | FastAPI推論                | 設計 | ⏳    | ⏳   |

---

## I. インフラ自動化スクリプト（scripts/infra — DDD）

| サブ機能                | 内容                            | 工程 | 状態 |
| ------------------- | ----------------------------- | -- | -- |
| DDDアーキテクチャ          | Domain / Usecase / Infra 分離   | 設計 | ✅  |
| DIコンテナ              | Awilix                        | 実装 | ✅  |
| Domain層              | EksCluster, NodeGroup, DB, VO | 実装 | ✅  |
| Cluster Usecases    | Provision / Destroy / Query   | 実装 | ✅  |
| Deployment Usecases | DeployAll / App / GPU / MLOps | 実装 | ✅  |
| Database Usecases   | Deploy / Manage               | 実装 | ✅  |
| MLOps Usecases      | Build / Manage                | 実装 | ✅  |
| K8s Deployers       | ALB / App / GPU / Helm / MLOps / Manifest | 実装 | ✅  |
| K8s Monitors        | ASG / Bastion / Cluster / K8s / NodeGroup | 実装 | ✅  |
| AWS API             | ECR / EKS / S3 / Secrets     | 実装 | ✅  |
| AWS Operations      | ResourceCleaner / S3Uploader / SSMDiag | 実装 | ✅  |
| Terraform統合         | Runner / OrphanCleaner / Outputs | 実装 | ✅  |
| Framework           | Command / Errors / Lifecycle / Logging / Narrative | 実装 | ✅  |
| Smoke Tests         | 8スイート (AWS/EKS/K8s/DB/App/Auth/Login/Monitoring) | 検証 | ✅  |
| CLI                 | infra / kubernetes / mlops / terraform | 実装 | ✅  |
| Tools               | AWS (7種) / Bastion / K8s / Setup | 実装 | ✅  |
| Unit Tests          | 36ファイル (Vitest)               | 検証 | ✅  |

---

## J. AWS Resource Monitor

| サブ機能              | 内容                          | 工程 | 状態 |
| ----------------- | --------------------------- | -- | -- |
| DDDアーキテクチャ        | Domain / Presentation / Infra | 設計 | ✅  |
| AWS Adapters      | 20+ サービス (EC2, EKS, S3等)   | 実装 | ✅  |
| K8s統合             | K8s API / SSM経由 / Prometheus | 実装 | ✅  |
| コスト監視             | Cost Explorer連携             | 実装 | ✅  |
| 認証                | Clerk + APIキー               | 実装 | ✅  |
| データベース            | MongoDB + Redis              | 実装 | ✅  |
| ジョブ管理             | メモリ / Redis JobStore        | 実装 | ✅  |
| Unit Tests        | 35+ ファイル (Vitest)           | 検証 | ✅  |
| Integration Tests | 2ファイル                       | 検証 | ✅  |

---

## 環境別サマリー

| 環境   | 状態                                        |
| ---- | ----------------------------------------- |
| Kind | **設計・実装・検証 完了**                           |
| EKS  | **基盤+アプリ+MLOps+GPU/LLM+Observability+ArgoCD 完了 / Admin UI動作確認中** |

---

## 現在地（1行要約）

**Kind では全機能が成立。
EKS は「FE/BE分離・認証・ECShop・MLOps Pipeline・GPU/LLM推論・Observability・ArgoCD GitOps 完了」フェーズ。残りはAdmin UI動作確認。
インフラ自動化スクリプトはDDDリファクタリング完了 (36テスト)。AWS Resource Monitor実装完了 (35+テスト)。**

---

### この構造の強み（重要）

* 「できている／いない」が **環境別に即判別**
* レビューで **「Kind止まりですか？」に即答可能**
* 次にやるべき作業は **EKS列の ⏳ を潰すだけ**

---

## 次のアクション

### 完了済み
- [x] MLOps E2E 本番実行確認
- [x] フロントエンド機能完成
- [x] 監視ダッシュボード構築
- [x] ArgoCD GitOps 有効化
- [x] インフラスクリプト DDDリファクタリング
- [x] AWS Resource Monitor 実装
- [x] Karpenter オートスケーリング (Terraform IRSA/SQS + GPU NodePool/EC2NodeClass + NVIDIA Plugin)
- [x] vLLM / TEI 推論サーバー構成 (K8sマニフェスト定義済み)

### 中優先度 (将来)
- [ ] GPU ノード実稼働検証 (Karpenter NodePool の実クラスタ適用)
- [ ] CronJob スケジューリング
- [ ] 商品画像アップロード
- [ ] EC Shop UIスタイル改善

### 低優先度 (将来)
- [ ] Argo Workflows (MLOpsオーケストレーション)
- [ ] dbt (データ変換/ELT)
- [ ] 感情分析リアルタイムAPI (FastAPI)
- [ ] PWA 対応
- [ ] 高度なセキュリティ設定 (Pod Security)

---

## 未対応作業サマリー

### WSL/Kind で開発可能（ローカル開発）

| カテゴリ | 作業内容 | 備考 |
| ------ | ------- | ---- |
| EC Shop | 商品画像 | フロント/バックエンド実装 |
| EC Shop | 全体的なスタイル修正 | UI/UX改善 |
| EC Shop | 分析に向いたDBテーブル設計 | Prisma schema変更 |
| MLOps | Argo Workflows（ワークフローオーケストレーション） | Kind上で検証可能 |
| MLOps | dbt（データ変換/ELT） | ローカルDBで検証可能 |
| MLOps | 感情分析リアルタイムAPI（FastAPI推論） | ローカル推論可能 |

### EKS 限定（クラウド連携/動作確認）

| カテゴリ | 作業内容 | 備考 |
| ------ | ------- | ---- |
| アプリ | Admin UI 動作確認 | Analytics / Audit / LLM |
| アプリ | Audit 動作確認 | 監査ログ取得 |
| アプリ | Analytics API 動作確認 | S3 読み取り |
| アプリ | LLM Proxy API 動作確認 | chat / embeddings |
| フロント | 管理画面 動作確認 | Analytics / Audit / LLM |
| バックエンド | Audit API 動作確認 | admin 限定 |
| バックエンド | Analytics API 動作確認 | /internal/analytics |
| バックエンド | LLM API 動作確認 | /internal/llm/* |
| MLOps | Snowflake Adapter | クラウド分析（EKS限定） |
| MLOps | Snowflake Secret | AWS Secrets Manager |
| MLOps | 感情分析ダッシュボード 動作確認 | 基本UI |
