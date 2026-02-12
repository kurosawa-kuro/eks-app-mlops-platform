# MLOps Pipeline

k8s-ml-app-platform プロジェクトの MLOps パイプライン。
DuckDB分析 + 日本語感情分析 を EKS + IRSA で実行。

最終更新日: 2025-12-12

---

## 🚀 Quick Start（Prod EKS）

```bash
# プロジェクトルートから実行

# 1. 設定確認
make mlops-info

# 2. ConfigMap/ServiceAccount デプロイ
make mlops-deploy

# 3. Analytics + Sentiment E2E実行（推奨）
make mlops-e2e-analytics

# 4. API確認
make mlops-api-check
```

### 個別Job実行

```bash
# DuckDB Analytics
make mlops-analytics
kubectl wait --for=condition=complete job/data-analytics -n mlops --timeout=300s

# Sentiment Analysis（レビューデータ生成→感情分析）
make mlops-generate-reviews    # ローカルからS3へアップロード
make mlops-sentiment           # EKS Job実行
```

### 結果確認

```bash
# S3の内容確認
make mlops-verify

# JSON結果表示
make mlops-analytics-results
make mlops-sentiment-results

# Hono API経由（本番）
curl https://api.tk-k8s.com/internal/analytics/latest | jq
curl https://api.tk-k8s.com/internal/analytics/sentiment | jq
curl https://api.tk-k8s.com/internal/analytics/combined | jq
```

---

## 📋 Make コマンド一覧

| コマンド | 説明 |
|----------|------|
| `mlops-info` | 設定情報表示（S3バケット、IRSA Role、ECR URL） |
| `mlops-deploy` | ConfigMap/ServiceAccount をEKSにデプロイ |
| `mlops-build` | Docker イメージビルド |
| `mlops-push` | ECR Public にプッシュ |
| `mlops-analytics` | DuckDB分析Job実行 |
| `mlops-sentiment` | 感情分析Job実行 |
| `mlops-e2e-analytics` | Analytics + Sentiment E2E |
| `mlops-e2e` | 全ステージE2E |
| `mlops-api-check` | Hono APIエンドポイント確認 |
| `mlops-status` | Pod/Job/S3状態確認 |
| `mlops-verify` | S3出力確認 |
| `mlops-clean` | Job削除 |

---

## 📦 コアモジュール（Python実装）

### 設定管理
- ✅ `src/config.py`: 環境変数ベースの設定管理
  - AWS設定（リージョン、S3バケット）
  - S3パス設定（raw/processed/models/analytics/sentiment）
  - 処理設定（scaler_type, model_type）
  - S3 URI生成プロパティ

### データ前処理
- ✅ `src/preprocess.py`: Preprocessorクラス
  - S3からのCSVダウンロード機能
  - S3へのCSVアップロード機能
  - 欠損値補完（中央値で補完）
  - 数値特徴量のスケーリング（StandardScaler / MinMaxScaler）
  - 前処理パイプライン実行（runメソッド）

### モデル学習
- ✅ `src/train.py`: Trainerクラス
  - S3からのデータダウンロード
  - モデル作成（RandomForest / LinearRegression）
  - 学習・評価（train/test split）
  - メトリクス計算（MSE, RMSE, MAE, R²）
  - モデル・メトリクスのS3アップロード
  - タイムスタンプ付きバージョン管理
  - latest版の自動更新

### データ分析
- ✅ `src/analytics.py`: Analyticsクラス
  - DuckDBベースの分析エンジン
  - ダミーデータ生成機能（検証用）
  - S3からのデータ読み込み
  - 集計クエリ実行
    - サマリー統計（総取引数、総売上、平均売上など）
    - カテゴリ別売上分析
    - 地域別売上分析
    - 日次トレンド分析
    - トップ顧客分析
    - 割引影響分析
  - 結果のJSON形式でのS3アップロード
  - タイムスタンプ付きバージョン管理
  - latest版の自動更新

### 感情分析
- ✅ `src/sentiment.py`: SentimentAnalyzerクラス
  - 日本語感情分析モデル（jarvisx17/japanese-sentiment-analysis）
  - Transformersライブラリを使用した推論
  - S3からのレビューデータダウンロード
  - バッチ感情分析処理
  - 感情ラベル分類（positive/negative/neutral）
  - スコア計算（softmax）
  - サマリー統計生成
  - 結果のJSON形式でのS3アップロード

### データ生成
- ✅ `src/generate.py`: DataGeneratorクラス
  - 回帰用サンプルデータ生成
  - NaN値の自動挿入（検証用）
  - S3へのデータアップロード

- ✅ `src/generate_reviews.py`: ReviewGeneratorクラス
  - ダミーレビューデータ生成（日本語）
  - 感情分布のバランス調整（positive 40%, neutral 30%, negative 30%）
  - 商品IDの自動割り当て
  - S3へのレビューデータアップロード

---

## 🚀 エントリーポイント・スクリプト

### メインエントリーポイント
- ✅ `scripts/entrypoint.py`: パイプラインステージ実行
  - コマンドライン引数パース（--stage）
  - 対応ステージ: generate, preprocess, train, analytics, generate-reviews, sentiment
  - エラーハンドリング・ロギング

### ユーティリティスクリプト
- ✅ `scripts/generate_data.py`: ローカルデータ生成
  - 回帰用サンプルデータ生成
  - CSV出力

- ✅ `scripts/upload_data.py`: S3アップロードユーティリティ
  - ローカルファイルをS3にアップロード
  - バケット・キー指定可能

---

## ☸️ Kubernetesリソース

### Job定義
- ✅ `k8s/job-generate.yaml`: データ生成Job
  - リソース制限（memory: 512Mi, cpu: 500m）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

- ✅ `k8s/job-preprocess.yaml`: 前処理Job
  - リソース制限（memory: 1Gi, cpu: 500m）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

- ✅ `k8s/job-train.yaml`: 学習Job
  - リソース制限（memory: 2Gi, cpu: 1000m）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

- ✅ `k8s/job-analytics.yaml`: 分析Job
  - リソース制限（memory: 2Gi, cpu: 1000m）
  - ダミーデータ使用フラグ（USE_DUMMY_DATA）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

- ✅ `k8s/job-generate-reviews.yaml`: レビューデータ生成Job
  - リソース制限（memory: 512Mi, cpu: 500m）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

- ✅ `k8s/job-sentiment.yaml`: 感情分析Job
  - リソース制限（memory: 4Gi, cpu: 2000m）
  - CPU推論（GPUなしで動作）
  - ConfigMap参照
  - ServiceAccount使用（IRSA対応）

### 設定リソース
- ✅ `k8s/configmap.yaml`: 環境変数設定
  - AWS設定
  - S3パス設定
  - 処理設定（scaler_type, model_type）
  - プレースホルダー対応（バケット名はMakefileで設定）

- ✅ `k8s/serviceaccount.yaml`: ServiceAccount定義
  - IRSAアノテーション対応
  - プレースホルダー対応（ロールARNはMakefileで設定）

---

## 🐳 コンテナ化

- ✅ `docker/Dockerfile`: MLOpsパイプラインコンテナ
  - Python 3.11-slimベース
  - システム依存関係インストール
  - requirements.txtからの依存関係インストール
  - ソースコードコピー
  - entrypoint.pyをエントリーポイントとして設定

---

## 📋 依存関係

- ✅ `requirements.txt`: Python依存関係
  - AWS SDK（boto3）
  - データ処理（pandas, numpy, duckdb）
  - 機械学習（scikit-learn）
  - NLP（transformers, torch, scipy, protobuf）
  - 日本語NLP（fugashi, unidic-lite）

---

## 🔄 パイプラインステージ

### 実装済みステージ
1. ✅ **generate**: サンプルデータ生成
2. ✅ **preprocess**: データ前処理（欠損値補完・スケーリング）
3. ✅ **train**: モデル学習（RandomForest / LinearRegression）
4. ✅ **analytics**: データ分析（DuckDBベース）
5. ✅ **generate-reviews**: レビューデータ生成
6. ✅ **sentiment**: 感情分析（日本語レビュー）

---

## 🔗 統合状況

### Hono API統合
- ✅ AnalyticsService実装済み（Hono API内）
- ✅ S3Adapter実装済み（Hono API内）
- ✅ 統合APIエンドポイント実装済み
  - `GET /internal/analytics/latest`: 最新分析結果取得
  - `GET /internal/analytics/sentiment`: 感情分析結果取得
  - `GET /internal/analytics/combined`: 売上+感情分析統合結果取得

### S3統合
- ✅ IRSA（IAM Roles for Service Accounts）対応
- ✅ S3バケット構成
  - `raw/`: 生データ
  - `processed/`: 前処理済みデータ
  - `models/`: 学習済みモデル・メトリクス
  - `analytics/`: 分析結果
  - `sentiment/`: 感情分析結果

---

## ⚠️ 未実装・要確認項目

### 本番環境での動作確認
- ⏳ prod EKSでのMLOps Job実行確認（make mlops-e2e-analytics）
- ⏳ prod S3への出力確認（make mlops-verify）
- ⏳ Hono APIからのデータ取得確認（make mlops-api-check）

### GPU/LLM統合（次フェーズ）
- 🔜 Karpenter GPU provisioner作成
- 🔜 NVIDIA Device Pluginデプロイ
- 🔜 FastAPI LLMサーバー実装
- 🔜 Hono → FastAPI → GPU統合

> ⚡ **Note**: sentiment（jarvisx17/japanese-sentiment-analysis）はCPU推論で十分高速。
> GPUは不要で、現在のEKS CPUノードで問題なく動作します。

---

## 📊 データフロー

```
[生データ生成]
  ↓
[前処理] → S3 (processed/)
  ↓
[学習] → S3 (models/)
  ↓
[分析] → S3 (analytics/)
  ↓
[レビュー生成] → S3 (raw/reviews.csv)
  ↓
[感情分析] → S3 (analytics/sentiment_results.json)
  ↓
[Hono API] → 統合結果返却
```

---

## 🎯 次のステップ

1. **prod E2E実行確認**: MLOps Job → S3 → Hono API の一貫動作確認
2. **GPU/LLM統合**: GPUノード・LLM推論サービスの追加
3. **監視・ロギング**: パイプライン実行状況の可視化
4. **スケジューリング**: CronJobによる定期実行設定

