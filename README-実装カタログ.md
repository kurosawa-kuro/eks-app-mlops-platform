# 実装カタログ

> **更新日**: 2026-02-12
> **プロジェクト**: EKS MLOps Platform (EC Shop + 感情分析)
> **用途**: 実装済み機能・ファイル構成のリファレンス（進捗管理は README-進捗管理.md を参照）

## コンポーネント概要

| コンポーネント | 主要技術 |
|---------------|---------|
| Backend (Hono) | TypeScript, Prisma, AWS SDK |
| Frontend (Next.js) | React 19, Zustand, Tailwind v4 |
| Auth Service | JWT, Cognito, RBAC |
| MLOps Pipeline | Python, DuckDB, Transformers |
| EKS Infrastructure | Terraform, VPC, EKS |
| K8s Manifests | Kustomize, CNPG, Monitoring |
| Monitoring Stack | Prometheus, Grafana, Loki |
| ArgoCD (GitOps) | ApplicationSet x 3 |
| Infra Scripts (DDD) | TypeScript, Vitest, Awilix DI |
| AWS Resource Monitor | Hono, DDD, 20+ AWS Adapters |

---

## apps/app-backend (Hono API Server)

### APIエンドポイント一覧

#### Shop API (`/api/shop/*`)
| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/shop/products` | 商品一覧 | 不要 |
| GET | `/api/shop/products/:id` | 商品詳細 | 不要 |
| GET | `/api/shop/cart` | カート取得 | 必須 |
| POST | `/api/shop/cart/add` | カート追加 | 必須 |
| POST | `/api/shop/cart/remove` | カート削除 | 必須 |
| DELETE | `/api/shop/cart` | カートクリア | 必須 |
| POST | `/api/shop/checkout` | 注文作成 | 必須 |
| GET | `/api/shop/orders` | 注文一覧 | 必須 |
| GET | `/api/shop/orders/:id` | 注文詳細 | 必須 |

#### Auth API (`/api/auth/*`)
| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/api/auth/login` | ログイン (Cognito委譲対応) | 不要 |
| POST | `/api/auth/logout` | ログアウト + トークン無効化 | 必須 |
| GET | `/api/auth/me` | ユーザー情報取得 | 必須 |
| POST | `/api/auth/refresh` | トークンリフレッシュ | 不要 |

#### Admin API (`/api/audit/*`, `/api/admin/*`)
| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/audit` | 監査ログ取得 (フィルタ対応) | admin |
| GET | `/api/audit/actions` | アクション種別一覧 | admin |
| POST | `/api/admin/register` | ユーザー登録 | admin |

#### DevTool API (`/health`, `/metrics`, `/internal/*`)
| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/health` | ヘルスチェック | 不要 |
| GET | `/health/status` | システム状態 | 不要 |
| POST | `/health/postgres` | DB接続テスト | 不要 |
| GET | `/metrics` | Prometheus メトリクス | 不要 |
| GET | `/internal/analytics` | 分析データ全体 | 不要 |
| GET | `/internal/analytics/summary` | サマリー統計 | 不要 |
| GET | `/internal/analytics/by-category` | カテゴリ別売上 | 不要 |
| GET | `/internal/analytics/by-region` | 地域別売上 | 不要 |
| GET | `/internal/analytics/daily-trend` | 日次トレンド | 不要 |
| GET | `/internal/analytics/sentiment` | 感情分析結果 | 不要 |
| GET | `/internal/analytics/combined` | 売上+感情統合 | 不要 |
| GET | `/internal/llm/health` | LLMサービスヘルス | 不要 |
| POST | `/internal/llm/chat` | チャット (vLLMプロキシ) | 不要 |
| POST | `/internal/llm/embeddings` | 埋め込み (TEIプロキシ) | 不要 |

### サービス層

| サービス | ファイル | 説明 |
|---------|--------|------|
| AuthService | `services/AuthService.ts` | 認証 (外部Cognito委譲対応) |
| AuthServiceClient | `services/AuthServiceClient.ts` | 外部認証クライアント |
| JwtService | `services/JwtService.ts` | JWT生成・検証 |
| PasswordService | `services/PasswordService.ts` | パスワードハッシュ (bcrypt) |
| CookieService | `services/CookieService.ts` | Cookie管理 |
| HealthService | `services/HealthService.ts` | システムヘルスチェック |
| AnalyticsService | `services/AnalyticsService.ts` | S3分析データ取得 |
| ProductService | `services/shop/ProductService.ts` | 商品管理 |
| CartService | `services/shop/CartService.ts` | カート操作 |
| OrderService | `services/shop/OrderService.ts` | 注文処理・チェックアウト |
| ShopAuditService | `services/shop/ShopAuditService.ts` | 監査ログ記録 |
| MetricsService | `services/metrics/MetricsService.ts` | リクエストメトリクス収集 |
| PrometheusFormatter | `services/metrics/PrometheusFormatter.ts` | Prometheus形式出力 |
| ConsoleLogService | `services/logs/Access/ConsoleLogService.ts` | コンソールアクセスログ |
| FirehoseService | `services/logs/Access/FirehoseService.ts` | Firehoseアクセスログ |
| CloudWatchErrorLogService | `services/logs/Error/CloudWatchErrorLogService.ts` | CloudWatchエラーログ |
| NullErrorLogService | `services/logs/Error/NullErrorLogService.ts` | Nullエラーログ (noop) |

### リポジトリ層

| リポジトリ | ファイル | 説明 |
|-----------|--------|------|
| PrismaUserRepository | `repositories/PrismaUserRepository.ts` | ユーザーCRUD |
| PrismaProductRepository | `repositories/shop/PrismaProductRepository.ts` | 商品データアクセス |
| PrismaCartRepository | `repositories/shop/PrismaCartRepository.ts` | カートデータアクセス |
| PrismaOrderRepository | `repositories/shop/PrismaOrderRepository.ts` | 注文データアクセス |
| PrismaAuditRepository | `repositories/shop/PrismaAuditRepository.ts` | 監査ログアクセス |

### アダプター層

| カテゴリ | アダプター | 説明 |
|---------|-----------|------|
| Database | `PostgresAdapter` | PostgreSQLヘルスチェック |
| Storage | `S3Adapter` | AWS S3操作 |
| Storage | `MockS3Adapter` | テスト用モックS3 |
| Cache | `InMemoryRateLimitStore` | メモリ内レート制限 |
| Cache | `RedisRateLimitStore` | Redisレート制限 |
| Token | `InMemoryTokenBlacklist` | メモリ内トークンブラックリスト |
| Token | `RedisTokenBlacklist` | Redisトークンブラックリスト |

### ミドルウェア

| カテゴリ | ミドルウェア | 説明 |
|---------|------------|------|
| Observability | `requestIdMiddleware` | リクエスト相関ID生成 (最初に実行) |
| Observability | `metricsMiddleware` | Prometheusカウンター |
| Observability | `accessLogMiddleware` | アクセスログ (Console/Firehose) |
| Observability | `errorHandler` | グローバルエラーハンドリング |
| Guard | `authRequired` / `requireRole` | 認証・認可ガード |
| Guard | `rateLimiter` | レート制限 |

### DIコンテナ (Awilix)

- `InjectionMode.CLASSIC` — コンストラクタパラメータ名で自動解決
- 環境変数による条件分岐登録 (Real S3 vs Mock, Redis vs InMemory, Firehose vs Console)
- Prismaクライアント: 遅延初期化グローバルシングルトン

### データベース (Prisma)

| モデル | 説明 |
|-------|------|
| `User` | ユーザー (email, role: user/admin) |
| `Product` | 商品カタログ (name, price, description, imageUrl) |
| `CartItem` | カートアイテム |
| `Order` | 注文 (total) |
| `OrderItem` | 注文明細 (非正規化商品情報) |
| `AuditLog` | 監査ログ (userId, action, detail) |

### テスト

| 種別 | ファイル数 | 対象 |
|------|----------|------|
| Unit | 11 | AuthService, JwtService, PasswordService, HealthService, MetricsService, FirehoseService, CloudWatchErrorLogService, OrderService, CartService, ShopAuditService, authGuard |
| Integration | 1 | 認証フロー統合テスト |
| E2E | 2 | 基本E2E, Shopフロー (Playwright) |

---

## apps/app-frontend (Next.js 16)

### ページ一覧

| パス | ファイル | 説明 | 認証 |
|------|--------|------|------|
| `/` | `app/page.tsx` | ランディングページ | 不要 |
| `/login` | `app/(auth)/login/page.tsx` | ログイン | 不要 |
| `/dashboard` | `app/(protected)/dashboard/page.tsx` | ダッシュボード | 必須 |
| `/shop/products` | `app/(protected)/shop/products/page.tsx` | 商品一覧 | 必須 |
| `/shop/products/:id` | `app/(protected)/shop/products/[id]/page.tsx` | 商品詳細 | 必須 |
| `/shop/cart` | `app/(protected)/shop/cart/page.tsx` | カート | 必須 |
| `/shop/orders` | `app/(protected)/shop/orders/page.tsx` | 注文履歴 | 必須 |
| `/shop/orders/:id` | `app/(protected)/shop/orders/[id]/page.tsx` | 注文詳細 | 必須 |
| `/admin/analytics` | `app/(protected)/admin/analytics/page.tsx` | 分析ダッシュボード | 必須 |
| `/admin/sentiment` | `app/(protected)/admin/sentiment/page.tsx` | 感情分析 | 必須 |
| `/admin/audit` | `app/(protected)/admin/audit/page.tsx` | 監査ログ | 必須 |
| `/admin/llm` | `app/(protected)/admin/llm/page.tsx` | LLMチャット | 必須 |

### APIルートハンドラ

| パス | 説明 |
|------|------|
| `app/api/auth/login/route.ts` | ログインプロキシ (Cookie転送) |
| `app/api/auth/logout/route.ts` | ログアウトプロキシ |
| `app/api/auth/me/route.ts` | ユーザー情報プロキシ |
| `app/api/health-proxy/route.ts` | ヘルスチェックプロキシ |

### コンポーネント

| カテゴリ | コンポーネント | ファイル |
|---------|------------|--------|
| Layout | Sidebar | `components/layout/Sidebar.tsx` |
| Layout | Header | `components/layout/Header.tsx` |
| Layout | Footer | `components/layout/Footer.tsx` |
| UI | Button | `components/ui/Button.tsx` |
| UI | Input | `components/ui/Input.tsx` |
| UI | Card | `components/ui/Card.tsx` |
| UI | Badge | `components/ui/Badge.tsx` |
| UI | StatCard | `components/ui/StatCard.tsx` |
| UI | Spinner | `components/ui/Spinner.tsx` |
| Charts | BarChart | `components/charts/BarChart.tsx` |
| Charts | LineChart | `components/charts/LineChart.tsx` |
| Charts | PieChart | `components/charts/PieChart.tsx` |
| Charts | DoughnutChart | `components/charts/DoughnutChart.tsx` |
| Auth | LoginForm | `components/features/auth/LoginForm.tsx` |
| Analytics | SummaryStats | `components/features/analytics/SummaryStats.tsx` |
| Analytics | CategoryChart | `components/features/analytics/CategoryChart.tsx` |
| Analytics | DailyTrendChart | `components/features/analytics/DailyTrendChart.tsx` |
| Shop | ProductCard | `components/features/shop/ProductCard.tsx` |
| Sentiment | ReviewList | `components/features/sentiment/ReviewList.tsx` |
| Sentiment | SentimentStats | `components/features/sentiment/SentimentStats.tsx` |
| LLM | ChatContainer | `components/features/llm/ChatContainer.tsx` |
| LLM | ChatMessage | `components/features/llm/ChatMessage.tsx` |
| LLM | ChatInput | `components/features/llm/ChatInput.tsx` |

### 状態管理 (Zustand)

| ストア | ファイル | 永続化 | 説明 |
|-------|--------|-------|------|
| authStore | `stores/authStore.ts` | localStorage (refreshTokenのみ) | 認証状態管理 |
| cartStore | `stores/cartStore.ts` | なし | カート管理 |
| uiStore | `stores/uiStore.ts` | なし | UI状態 |

### APIクライアント (`lib/api/`)

| モジュール | 説明 |
|-----------|------|
| `fetcher.ts` | 共通フェッチャー (認証ヘッダ自動付与) |
| `auth.ts` | 認証API (login, logout, me, refresh) |
| `shop.ts` | ショップAPI (products, cart, orders) |
| `analytics.ts` | 分析API |
| `audit.ts` | 監査API |
| `llm.ts` | LLM API |

### カスタムHooks

| Hook | 説明 |
|------|------|
| `useAuth` | 認証状態・ルートガード |
| `useAnalytics` | 分析データフェッチ |

### 型定義 (Zod)

| ファイル | 説明 |
|--------|------|
| `types/auth.ts` | 認証型 (User, LoginRequest等) |
| `types/shop.ts` | ショップ型 (Product, CartItem, Order等) |
| `types/analytics.ts` | 分析型 |
| `types/api.ts` | APIレスポンス型 |

### スタイリング

- Tailwind v4 CSS-first config (`globals.css` `@theme` ブロック)
- ダークモード: `@custom-variant dark (&:is(.dark *))`
- デザイントークン: Inter フォント, gray/violet カラーパレット
- ユーティリティクラス: `.btn` / `.btn-sm` / `.btn-lg`

---

## apps/auth (認証ゲートウェイ)

### 実装済み機能
- 認証エンドポイント
  - `POST /auth/login` - ログイン
  - `GET /auth/me` - ユーザー情報
  - `POST /auth/refresh` - トークンリフレッシュ
  - `POST /auth/logout` - ログアウト
- プラガブル認証アダプター
  - DummyAuthAdapter (開発用)
  - CognitoAuthAdapter (本番用)
- トークン管理
  - JWT生成・検証 (jose)
  - Access + Refresh トークン
  - トークンブラックリスト
- RBAC (ロールベースアクセス制御)
  - ロール: admin, user, guest
  - パーミッションシステム
- セキュリティ機能
  - レート制限
  - 監査ログ

### デプロイ
- **本番URL**: https://your-auth-gateway.example.com

---

## apps/aws-resource-monitor (AWSリソースモニター)

### 概要
AWSリソース・コスト・K8sクラスターの統合監視アプリケーション。DDD/クリーンアーキテクチャ。

### アーキテクチャ

```
domain/           → エンティティ, ユースケース, リポジトリインターフェース
  auth/           → ロール解決, ポリシー, 型定義
  entities/       → Resource, Cost, K8s, Settings
  repositories/   → Settings リポジトリI/F
  services/       → JobStore I/F
  usecases/       → Job管理, Settings管理
presentation/     → コントローラ, ルート, ミドルウェア
  controllers/    → Dashboard, AWS, K8s, Admin, Settings, DevTool, Jobs
  middleware/     → Clerk認証, APIキー認証, CORS, エラーハンドリング, レート制限
  routes/         → ルーティング定義
infra/            → 外部サービス統合
  aws/adapters/   → 20+ AWSサービスアダプター
  k8s/            → Kubernetes, Prometheus連携
  database/       → MongoDB, Redis クライアント
  cache/          → メモリキャッシュ
di/               → Awilix DIコンテナ
```

### AWSサービスアダプター (20+)

| アダプター | 対象サービス |
|-----------|------------|
| `acm.adapter.ts` | ACM (証明書) |
| `autoscaling.adapter.ts` | Auto Scaling |
| `cloudwatchlogs.adapter.ts` | CloudWatch Logs |
| `cost.adapter.ts` | Cost Explorer |
| `ec2.adapter.ts` | EC2 |
| `ecr.adapter.ts` | ECR |
| `eks.adapter.ts` | EKS |
| `elasticache.adapter.ts` | ElastiCache |
| `elb.adapter.ts` | ELB |
| `firehose.adapter.ts` | Firehose |
| `iam.adapter.ts` | IAM |
| `kms.adapter.ts` | KMS |
| `lambda.adapter.ts` | Lambda |
| `rds.adapter.ts` | RDS |
| `route53.adapter.ts` | Route53 |
| `s3.adapter.ts` | S3 |
| `sqs.adapter.ts` | SQS |
| `ssm.adapter.ts` | SSM |
| `vpc.adapter.ts` | VPC |

### K8s統合

| サービス | 説明 |
|---------|------|
| `k8sService.ts` | Kubernetes APIクライアント |
| `kubernetes.adapter.ts` | K8sリソース取得 |
| `kubernetes-ssm.adapter.ts` | SSM経由K8sアクセス |
| `prometheusService.ts` | Prometheusメトリクス取得 |
| `prometheus.adapter.ts` | Prometheusクエリ |

### テスト

| 種別 | ファイル数 | テストランナー |
|------|----------|------------|
| Unit | 35+ | Vitest |
| Integration | 2 | Vitest |

---

## mlops (ML パイプライン)

### パイプラインステージ

| # | ステージ | ファイル | 説明 |
|---|---------|--------|------|
| 1 | generate | `src/generate.py` | 合成売上データ生成 |
| 2 | generate-reviews | `src/generate_reviews.py` | レビューデータ生成 (日本語感情バランス) |
| 3 | preprocess | `src/preprocess.py` | データクリーニング・正規化 (欠損値補完, 特徴量スケーリング) |
| 4 | train | `src/train.py` | モデル学習 (RandomForest / LinearRegression, MSE/RMSE/MAE/R²) |
| 5 | analytics | `src/analytics.py` | DuckDB分析 (サマリー, カテゴリ別, 地域別, トレンド, 顧客) |
| 6 | sentiment | `src/sentiment.py` | 日本語感情分析 (jarvisx17/japanese-sentiment-analysis) |
| 7 | smoke | `src/smoke.py` | Smoke Test (IRSA/S3検証) |

### アダプター (プラガブル分析エンジン)

| アダプター | ファイル | 説明 |
|-----------|--------|------|
| Base | `src/adapters/base.py` | 分析アダプターI/F |
| DuckDB | `src/adapters/duckdb_adapter.py` | インメモリ分析 (デフォルト) |
| Snowflake | `src/adapters/snowflake_adapter.py` | クラウド分析 |

### S3 構造
```
raw/          → 元データ
processed/    → 前処理済みデータ
models/       → 学習モデル + メトリクス
analytics/    → 分析結果 (JSON)
sentiment/    → 感情分析結果 (JSON)
```

### K8s Jobs
| ファイル | 説明 |
|--------|------|
| `k8s/namespace-mlops.yaml` | MLOps Namespace |
| `k8s/serviceaccount.yaml` | IRSA用ServiceAccount |
| `k8s/configmap.yaml` | 設定 |
| `k8s/job-generate.yaml` | データ生成Job |
| `k8s/job-generate-reviews.yaml` | レビュー生成Job |
| `k8s/job-preprocess.yaml` | 前処理Job |
| `k8s/job-train.yaml` | 学習Job |
| `k8s/job-analytics.yaml` | 分析Job |
| `k8s/job-sentiment.yaml` | 感情分析Job |
| `k8s/job-smoke.yaml` | SmokeテストJob |

---

## scripts/infra (インフラ自動化 — DDDアーキテクチャ)

### 概要
TypeScript + DDD/クリーンアーキテクチャのインフラ自動化スクリプト群。EKSクラスターの構築・デプロイ・削除・監視を完全自動化。

### アーキテクチャ

```
scripts/infra/
├── cli/                          # CLIエントリーポイント
│   ├── infra/verify.ts
│   ├── kubernetes/
│   │   ├── argocd.ts
│   │   ├── db-deploy.ts
│   │   ├── deploy-all.ts
│   │   ├── deploy.ts
│   │   ├── init.ts
│   │   ├── monitoring.ts
│   │   └── verify.ts
│   ├── mlops/manage.ts
│   └── terraform/
│       ├── apply.ts
│       ├── destroy.ts
│       └── status.ts
├── config/                       # 設定
│   ├── env.ts
│   ├── paths.ts
│   └── timeouts.ts
├── container/                    # DIコンテナ
│   ├── index.ts
│   └── types.ts
├── domain/                       # ドメイン層
│   ├── cluster/
│   │   ├── EksCluster.ts         # EKSクラスタエンティティ
│   │   └── NodeGroup.ts          # ノードグループ値オブジェクト
│   ├── database/
│   │   └── DatabaseCluster.ts    # DBクラスタエンティティ
│   ├── errors/
│   │   ├── ClusterError.ts
│   │   ├── DatabaseError.ts
│   │   └── DomainError.ts
│   └── valueObjects/
│       ├── Overlay.ts            # Kustomize Overlay
│       ├── Phase.ts              # デプロイフェーズ
│       └── Region.ts             # AWSリージョン
├── framework/                    # 共通フレームワーク
│   ├── command/
│   │   ├── AwsCommand.ts         # AWSコマンドビルダー
│   │   ├── CommandBuilder.ts     # 汎用コマンドビルダー
│   │   └── InfraCommand.ts       # インフラコマンド基底
│   ├── errors/
│   │   ├── InfraError.ts         # インフラエラー型
│   │   └── retry.ts              # リトライ機構
│   ├── lifecycle/
│   │   ├── HTTPSVerifier.ts      # HTTPS検証
│   │   ├── Poller.ts             # ポーリング (指数バックオフ)
│   │   └── PreflightChecker.ts   # 事前チェック
│   ├── logging/
│   │   ├── FileLogger.ts         # ファイルロガー
│   │   ├── colors.ts             # カラー出力
│   │   ├── logger.ts             # 標準ロガー
│   │   └── structured.ts         # 構造化ログ
│   ├── narrative/
│   │   ├── context.ts            # ナラティブコンテキスト
│   │   ├── next-steps.ts         # 次ステップ表示
│   │   ├── outcome.ts            # 結果表示
│   │   ├── preflight-display.ts  # Preflight表示
│   │   ├── timer.ts              # タイマー
│   │   └── types.ts
│   ├── utils/
│   │   ├── format.ts             # フォーマッター
│   │   ├── interaction.ts        # ユーザーインタラクション
│   │   ├── mask.ts               # マスキング
│   │   └── validation.ts         # バリデーション
│   └── types.ts
├── infrastructure/               # インフラストラクチャ層
│   ├── aws/
│   │   ├── api/                  # AWS APIラッパー
│   │   │   ├── core.ts
│   │   │   ├── ecr.ts
│   │   │   ├── eks.ts
│   │   │   ├── s3.ts
│   │   │   └── secrets.ts
│   │   ├── operations/           # リソース操作
│   │   │   ├── ResourceCleaner.ts
│   │   │   ├── S3Uploader.ts
│   │   │   └── SSMDiagnostics.ts
│   │   └── runtime/
│   │       └── SSMCommandRunner.ts
│   ├── kubernetes/
│   │   ├── deploy/               # デプロイヤー
│   │   │   ├── ALBControllerDeployer.ts
│   │   │   ├── AppManifestDeployer.ts
│   │   │   ├── GPUStackDeployer.ts
│   │   │   ├── HelmDeployer.ts
│   │   │   ├── MLOpsManifestDeployer.ts
│   │   │   └── ManifestDeployer.ts
│   │   ├── manifest/             # マニフェスト処理
│   │   │   ├── engine.ts
│   │   │   └── renderer.ts
│   │   └── monitor/              # モニター
│   │       ├── ASGMonitor.ts
│   │       ├── BastionMonitor.ts
│   │       ├── ClusterMonitor.ts
│   │       ├── KubernetesMonitor.ts
│   │       └── NodeGroupMonitor.ts
│   ├── shell/exec.ts
│   └── terraform/
│       ├── OrphanCleaner.ts
│       ├── TerraformRunner.ts
│       └── outputs.ts
├── smoke/                        # Smokeテスト (8スイート)
│   ├── index.ts
│   ├── aws.smoke.ts
│   ├── eks.smoke.ts
│   ├── k8s.smoke.ts
│   ├── db.smoke.ts
│   ├── app.smoke.ts
│   ├── auth.smoke.ts
│   ├── login.smoke.ts
│   └── monitoring.smoke.ts
├── tools/                        # ユーティリティツール
│   ├── aws/
│   │   ├── cognito.ts, ec2.ts, ecr.ts, eks.ts
│   │   ├── firehose.ts, s3.ts, secrets.ts
│   ├── bastion/connect.ts
│   ├── kubernetes/
│   │   ├── debug.ts, kind.ts
│   └── setup/prerequisites.ts
└── usecases/                     # ユースケース層
    ├── base/UseCase.ts           # ユースケース基底クラス
    ├── cluster/
    │   ├── DestroyCluster.ts     # クラスター削除
    │   ├── ProvisionCluster.ts   # クラスター構築
    │   ├── QueryClusterStatus.ts # 状態照会
    │   └── phases/               # フェーズ分割
    │       ├── PreflightPhase.ts
    │       ├── TerraformPhase.ts
    │       ├── ClusterWaitPhase.ts
    │       ├── BastionWaitPhase.ts
    │       ├── ASGWaitPhase.ts
    │       ├── NodeGroupWaitPhase.ts
    │       ├── NodeReadyPhase.ts
    │       ├── KubeconfigPhase.ts
    │       └── SmokeTestPhase.ts
    ├── database/
    │   ├── DeployDatabase.ts     # DB デプロイ
    │   └── ManageDatabase.ts     # DB 管理
    ├── deployment/
    │   ├── DeployAll.ts          # 全体デプロイ
    │   ├── DeployApp.ts          # アプリデプロイ
    │   ├── DeployGPU.ts          # GPUスタックデプロイ
    │   ├── DeployMLOps.ts        # MLOpsデプロイ
    │   ├── VerifyDeployment.ts   # デプロイ検証
    │   └── phases/
    │       ├── ALBSetupPhase.ts
    │       ├── AppDeployPhase.ts
    │       ├── GPUStepPhase.ts
    │       ├── HTTPSVerifyPhase.ts
    │       ├── MLOpsDeployPhase.ts
    │       └── ManifestUploadPhase.ts
    └── mlops/
        ├── BuildMLOps.ts         # MLOpsビルド
        └── ManageMLOps.ts        # MLOpsジョブ管理
```

### テスト (Vitest — 36ファイル)

| カテゴリ | テストファイル | 対象 |
|---------|-------------|------|
| Domain | `EksCluster.test.ts` | クラスタエンティティ |
| Domain | `Overlay.test.ts`, `Phase.test.ts`, `Region.test.ts` | 値オブジェクト |
| Framework | `CommandBuilder.test.ts` | コマンドビルダー |
| Framework | `InfraError.test.ts`, `retry.test.ts` | エラー/リトライ |
| Framework | `HTTPSVerifier.test.ts`, `Poller.test.ts`, `PreflightChecker.test.ts` | ライフサイクル |
| Framework | `FileLogger.test.ts` | ロギング |
| Infra/AWS | `ecr.test.ts`, `s3.test.ts`, `secrets.test.ts` | AWS API |
| Infra/AWS | `S3Uploader.test.ts`, `SSMDiagnostics.test.ts` | Operations |
| Infra/AWS | `SSMCommandRunner.test.ts` | Runtime |
| Infra/K8s | `HelmDeployer.test.ts`, `ManifestDeployer.test.ts` | Deploy |
| Infra/K8s | `engine.test.ts`, `renderer.test.ts` | Manifest |
| Infra/K8s | `BastionMonitor.test.ts`, `KubernetesMonitor.test.ts`, `NodeGroupMonitor.test.ts` | Monitor |
| Infra/Shell | `exec.test.ts` | シェル実行 |
| Infra/TF | `OrphanCleaner.test.ts`, `TerraformRunner.test.ts`, `outputs.test.ts` | Terraform |
| Usecases | `DestroyCluster.test.ts`, `QueryClusterStatus.test.ts` | Cluster |
| Usecases | `ManageDatabase.test.ts` | Database |
| Usecases | `DeployAll.test.ts`, `DeployApp.test.ts`, `DeployGPU.test.ts`, `DeployMLOps.test.ts`, `VerifyDeployment.test.ts` | Deployment |
| Usecases | `BuildMLOps.test.ts`, `ManageMLOps.test.ts` | MLOps |
| Utils | `format.test.ts`, `mask.test.ts`, `validation.test.ts` | ユーティリティ |

---

## infra/terraform/prod (本番EKS)

### Terraformファイル一覧

| ファイル | 説明 |
|--------|------|
| `00_provider.tf` | AWSプロバイダー設定 |
| `10_vpc.tf` | VPC, 2 Public + 2 Private Subnet, NAT GW, IGW |
| `20_security_groups.tf` | EKS, ALB, Bastion用SG |
| `30_eks.tf` | EKSクラスター v1.29 (Private Endpoint) + Node Group (t3.medium x2) |
| `35_karpenter.tf` | Karpenterオートスケーラー |
| `40_alb.tf` | Application Load Balancer |
| `45_route53.tf` | Route53 DNS統合 |
| `50_acm.tf` | ACM SSL証明書 |
| `60_s3.tf` | S3バケット (MLOpsデータ) |
| `65_kms.tf` | KMS暗号化キー (EBS/Secrets) |
| `70_logging.tf` | CloudWatch Logs |
| `80_iam.tf` | IAMロール・ポリシー |
| `85_bastion.tf` | Bastion (t3.small, SSM-only) |
| `86_helm.tf` | Helm管理 (ArgoCD等) |
| `88_data_sources.tf` | データソース |
| `90_outputs.tf` | アウトプット |

### 実装済みリソース
- **VPC**: 2 Public + 2 Private サブネット (Multi-AZ), NAT Gateway, VPC Flow Logs
- **EKS**: Cluster v1.29, Managed Node Group (t3.medium x2), EBS/Secrets暗号化 (KMS)
- **アドオン**: CoreDNS, kube-proxy, vpc-cni, aws-ebs-csi-driver (IRSA)
- **ネットワーク**: ALB (HTTPS), VPC Endpoints (SSM, ECR, S3, KMS, Logs, STS), Route53, ACM
- **運用**: Bastion (SSM-only), CloudWatch Logs, Kinesis Data Firehose
- **オートスケーリング**: Karpenter (GPUノードプール設定済み)
- **Helm**: ArgoCD

---

## infra/terraform/shared (共有リソース)

### Terraformファイル一覧

| ファイル | 説明 |
|--------|------|
| `00_provider.tf` | AWSプロバイダー |
| `10_ecr.tf` | ECRプライベートリポジトリ (backend, frontend, mlops, auth) |
| `20_s3.tf` | S3バケット (MLOpsデータ, バージョニング, 暗号化, Glacierトランジション) |
| `30_firehose.tf` | Kinesis Firehose (アクセスログ→S3) |
| `90_outputs.tf` | アウトプット |

---

## infra/k8s (Kubernetes マニフェスト)

### アプリケーション (`apps/`)

| マニフェスト | 説明 |
|------------|------|
| `namespace.yaml` | app Namespace |
| `namespace-database.yaml` | database Namespace |
| `serviceaccount.yaml` | IRSA ServiceAccount |
| `configmap.yaml` | アプリ設定 |
| `secrets.yaml` | シークレット |
| `backend-deployment.yaml` | Backend Deployment |
| `backend-service.yaml` | Backend Service |
| `frontend-deployment.yaml` | Frontend Deployment |
| `frontend-service.yaml` | Frontend Service |
| `ingress.yaml` | Ingress (ALB) |

**オーバーレイ**: `local/` (Kind), `staging/` (EC2+Kind), `prod/` (EKS)

### データベース (`cnpg/`)

| マニフェスト | 説明 |
|------------|------|
| `namespace.yaml` | database Namespace |
| `operator-install.yaml` | CloudNativePG Operator |
| `cluster.yaml` | PostgreSQL Cluster |
| `secrets.yaml` | DB Secrets |

**オーバーレイ**: `local/`, `staging/`, `prod/`

### 監視 (`monitoring/`)

| コンポーネント | 構成 |
|-------------|------|
| **Prometheus** | Deployment + Service + ConfigMap (scrape設定) + ServiceAccount + ClusterRole |
| **Grafana** | Deployment + Service + ConfigMap (データソース, ダッシュボード) |
| **Alertmanager** | Deployment + Service + ConfigMap (通知設定) |
| **Loki** | Deployment + Service + ConfigMap |
| **Promtail** | DaemonSet + ServiceAccount + ConfigMap |
| **Node-exporter** | DaemonSet + Service |
| **Kube-state-metrics** | Deployment + Service + ServiceAccount + ClusterRole |

**オーバーレイ**: `local/`, `prod/`

### GPU/LLM (`karpenter/`, `llm/`)

| マニフェスト | 説明 |
|------------|------|
| `gpu-nodepool.yaml` | GPU NodePool (g5/g6 Spot + On-Demand) |
| `gpu-ec2nodeclass.yaml` | GPU EC2NodeClass |
| `gpu-check-pod.yaml` | GPU検証Pod |
| `nvidia-device-plugin.yaml` | NVIDIAデバイスプラグイン |
| `llm-inference-deployment.yaml` | vLLM推論サーバー (Qwen2.5-1.5B) |
| `llm-inference-service.yaml` | 推論Service |
| `llm-embeddings-deployment.yaml` | TEI埋め込みサーバー (multilingual-e5-small) |
| `llm-embeddings-service.yaml` | 埋め込みService |

### ArgoCD (`argocd/`)

| ApplicationSet | 対象 | Namespace |
|----------------|------|-----------|
| `app-appset.yaml` | Frontend + Backend | app |
| `cnpg-appset.yaml` | CloudNativePG | database |
| `monitoring-appset.yaml` | Prometheus/Grafana/Loki | monitoring |

**機能**: 自動同期 (prune: true, selfHeal: true), Namespace自動作成, Kustomize overlay対応

---

## 統合アーキテクチャ図

```
┌──────────────────────────────────────────────┐
│         Frontend (Next.js 16)                │
│         React 19 + Zustand + Chart.js        │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│         Backend (Hono API)                   │
│    Shop / Analytics / LLM エンドポイント      │
└──────┬───────────┬───────────┬───────────────┘
       │           │           │
┌──────▼────┐ ┌────▼────┐ ┌────▼─────┐
│ PostgreSQL │ │  Redis  │ │ Auth Svc │
│  (CNPG)    │ │  Cache  │ │ (Render) │
└────────────┘ └─────────┘ └──────────┘
                   │
       ┌───────────▼───────────┐
       │   MLOps Pipeline      │
       │ (Python + K8s Jobs)   │
       └───────────┬───────────┘
                   │
       ┌───────────▼───────────┐
       │   S3 Analytics Data   │
       │ (analytics/sentiment) │
       └───────────────────────┘
                   │
       ┌───────────▼───────────┐
       │   Monitoring Stack    │
       │ Prometheus + Grafana  │
       │ Loki + Alertmanager   │
       │ Kube-state-metrics    │
       └───────────────────────┘
                   │
       ┌───────────▼───────────┐
       │      ArgoCD           │
       │   GitOps 自動デプロイ   │
       └───────────────────────┘
                   │
       ┌───────────▼───────────┐
       │  AWS Resource Monitor │
       │   20+ サービス監視     │
       └───────────────────────┘
```

---

## テストカバレッジ総括

| コンポーネント | Unit | Integration | E2E | Smoke | ランナー |
|-------------|------|-------------|-----|-------|---------|
| app-backend | 11 | 1 | 2 | — | Jest + Playwright |
| app-frontend | — | — | — | — | — |
| auth | — | — | — | — | — |
| aws-resource-monitor | 35+ | 2 | — | — | Vitest |
| scripts/infra | 36 | — | — | 8 | Vitest |
| mlops | — | — | — | 1 | pytest |

---

## 運用コマンド

### デプロイ
```bash
make eks-deploy-all          # Phase 0-9 一括実行
make mlops-e2e-analytics     # MLOps E2E パイプライン
```

### 削除
```bash
make eks-destroy             # EKSクラスター削除 (自動K8sクリーンアップ)
make eks-destroy DRY_RUN=1   # Dry-run モード
```

### 監視
```bash
make eks-monitoring-grafana  # Grafana UI (localhost:3000)
make eks-monitoring-status   # Monitoring Stack 状態
make eks-argocd              # ArgoCD UI (localhost:8080)
make eks-argocd-status       # ApplicationSets 確認
```

### 検証
```bash
make eks-smoke-strict        # インフラ Smoke Test
make mlops-smoke             # MLOps Smoke Test
make eks-verify              # Health + Login 検証
```

### ローカル開発
```bash
make local-dev               # Backend (port 8000) + Frontend (port 3000)
make local-test              # Backend Unit Tests (Jest ESM)
make local-test-e2e          # E2E Tests (Playwright)
make local-lint              # ESLint (backend + frontend)
make local-typecheck         # TypeScript型チェック
```

