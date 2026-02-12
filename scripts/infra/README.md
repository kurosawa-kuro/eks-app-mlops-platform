# Infrastructure Scripts

EKS MLOps プラットフォーム用 TypeScript インフラストラクチャスクリプト。

## アーキテクチャ

Clean Architecture パターンを採用:

```
scripts/infra/
├── domain/                 # ドメイン層 - ビジネスロジック
│   ├── cluster/            # EKS クラスタドメインモデル
│   ├── database/           # データベースドメインモデル
│   ├── errors/             # ドメインエラー
│   └── valueObjects/       # 値オブジェクト (Region, Overlay, Phase)
│
├── usecases/               # ユースケース層 - アプリケーションロジック
│   ├── cluster/            # クラスタ操作 (Provision, Destroy, Query)
│   ├── database/           # データベース操作 (ManageDatabase)
│   ├── deployment/         # デプロイ操作 (DeployApp, DeployMLOps, DeployGPU)
│   └── mlops/              # MLOps 操作 (ManageMLOps, BuildMLOps)
│
├── infrastructure/         # インフラ層 - 外部システム連携
│   ├── aws/
│   │   ├── api/            # stateless query (ECR, EKS, S3, Secrets)
│   │   ├── operations/     # stateful ops (ResourceCleaner, S3Uploader, SSMDiagnostics)
│   │   └── runtime/        # command exec (SSMCommandRunner)
│   ├── kubernetes/
│   │   ├── deploy/         # deployers (Manifest, Helm, App, MLOps, GPU, ALB)
│   │   ├── monitor/        # monitors (Cluster, NodeGroup, ASG, Bastion, Kubernetes)
│   │   └── manifest/       # template rendering (engine, renderer, templates/)
│   ├── shell/              # シェルコマンド実行
│   ├── terraform/          # Terraform 出力・実行
│   └── types.ts            # 外部境界型定義 + Zod スキーマ
│
├── framework/              # フレームワーク層 - 共通基盤
│   ├── command/            # CLI 基底クラス (InfraCommand, AwsCommand)
│   ├── errors/             # エラーハンドリング (InfraError, withRetry)
│   ├── lifecycle/          # ライフサイクル (PreflightChecker, Poller)
│   ├── logging/            # ロギング (log, colors)
│   ├── narrative/          # CLI 出力標準化 (起承転結: Context, Outcome)
│   ├── utils/              # ユーティリティ (format, mask, validation)
│   └── types.ts            # 内部フレームワーク型定義
│
├── container/              # DI コンテナ (Awilix)
│   ├── index.ts            # コンテナファクトリ
│   └── types.ts            # インターフェース定義
│
├── cli/                    # CLI エントリーポイント
│   ├── kubernetes/         # K8s 操作 (deploy, db-deploy, verify)
│   ├── mlops/              # MLOps ジョブ管理
│   └── terraform/          # Terraform 操作 (apply, destroy, status)
│
├── tools/                  # スタンドアロン CLI ツール
│   ├── aws/                # AWS サービス管理 (ecr, eks, s3, secrets, ec2, cognito, firehose)
│   ├── bastion/            # Bastion ホスト接続
│   ├── kubernetes/         # K8s ユーティリティ (debug, kind)
│   └── setup/              # 前提条件セットアップ
│
├── config/                 # 実行時設定
│   ├── index.ts            # 設定エクスポート + createConfig
│   ├── timeouts.ts         # タイムアウト定数
│   └── paths.ts            # パス定数
│
├── smoke/                  # スモークテスト
│   ├── index.ts            # テストランナー
│   ├── aws.smoke.ts        # AWS 接続テスト
│   ├── eks.smoke.ts        # EKS クラスタテスト
│   ├── k8s.smoke.ts        # Kubernetes 接続テスト
│   └── app.smoke.ts        # アプリケーションヘルスチェック
│
└── __tests__/              # ユニットテスト (41 ファイル, 434 テスト)
```

---

## 統計

| 項目 | 数値 |
|------|------|
| TypeScript ファイル数 | 156 |
| ユニットテスト数 | 434 |
| テストファイル数 | 41 |
| スモークテスト数 | 4 スイート |

---

## 使用方法

### セットアップ

```bash
cd scripts/infra
npm install
```

### npm scripts

```bash
npm run typecheck      # TypeScript 型チェック
npm test               # ユニットテスト実行
npm run test:watch     # テストウォッチモード
npm run test:coverage  # カバレッジレポート
```

### ライブラリのインポート (推奨)

```typescript
// Shell execution & Logging
import { run } from '../infrastructure/shell/index.js';
import { log, c } from '../framework/logging/index.js';

// AWS - API (stateless queries)
import { awsGetRegion, awsGetAccountId } from '../infrastructure/aws/api/core.js';
import { ecrListRepositories } from '../infrastructure/aws/api/ecr.js';
import { eksGetClusterInfo } from '../infrastructure/aws/api/eks.js';
import { s3ListBuckets } from '../infrastructure/aws/api/s3.js';
import { secretsList } from '../infrastructure/aws/api/secrets.js';

// AWS - Operations (stateful)
import { S3Uploader } from '../infrastructure/aws/operations/S3Uploader.js';
import { ResourceCleaner } from '../infrastructure/aws/operations/ResourceCleaner.js';

// AWS - Runtime (command execution)
import { SSMCommandRunner } from '../infrastructure/aws/runtime/SSMCommandRunner.js';

// Kubernetes - Deployers
import { ManifestDeployer } from '../infrastructure/kubernetes/deploy/ManifestDeployer.js';
import { HelmDeployer } from '../infrastructure/kubernetes/deploy/HelmDeployer.js';
import { AppManifestDeployer } from '../infrastructure/kubernetes/deploy/AppManifestDeployer.js';

// Kubernetes - Monitors
import { ClusterMonitor } from '../infrastructure/kubernetes/monitor/ClusterMonitor.js';
import { NodeGroupMonitor } from '../infrastructure/kubernetes/monitor/NodeGroupMonitor.js';
import { BastionMonitor } from '../infrastructure/kubernetes/monitor/BastionMonitor.js';

// Kubernetes - Manifests
import { renderManifest, TEMPLATES } from '../infrastructure/kubernetes/manifest/index.js';

// Lifecycle utilities
import { PreflightChecker } from '../framework/lifecycle/PreflightChecker.js';
import { Poller } from '../framework/lifecycle/Poller.js';

// Error handling
import { InfraError } from '../framework/errors/InfraError.js';
import { withRetry } from '../framework/errors/retry.js';

// Narrative (CLI output formatting - 起承転結)
import { showContext, showOutcome, Timer } from '../framework/narrative/index.js';

// Utils
import { validateResourceName } from '../framework/utils/validation.js';
import { formatBytes, formatDate } from '../framework/utils/format.js';

// Types
import type { RunOptions, RunResult } from '../infrastructure/types.js';
import type { Logger, CheckResult } from '../framework/types.js';
```

### 設定のインポート

```typescript
import { createConfig, TIMEOUTS, POLL_INTERVALS, PATHS } from '../config/index.js';

const config = createConfig();
const clusterName = config.require('clusterName');
```

### CLI スクリプト実行

```bash
# Terraform
npx tsx cli/terraform/apply.ts
npx tsx cli/terraform/destroy.ts
npx tsx cli/terraform/status.ts

# Kubernetes
npx tsx cli/kubernetes/deploy.ts app
npx tsx cli/kubernetes/db-deploy.ts deploy
npx tsx cli/kubernetes/verify.ts

# Tools
npx tsx tools/aws/ecr.ts list
npx tsx tools/aws/s3.ts list
npx tsx tools/kubernetes/debug.ts pods
npx tsx tools/kubernetes/kind.ts create

# スモークテスト
npx tsx smoke/index.ts run --strict
```

### Makefile からの実行

```bash
# EKS デプロイ
make eks-deploy

# Kind ローカル開発
make kind-create
make kind-deploy

# スモークテスト
make eks-smoke-strict
```

---

## 主要 CLI コマンド

### cli/terraform/apply.ts

EKS クラスタのプロビジョニング。Terraform apply と各リソースの準備完了を待機。

```bash
npx tsx cli/terraform/apply.ts [--timeout <seconds>] [--skip-apply] [--skip-smoke]
```

**フェーズ:**
1. Pre-flight Checks
2. Terraform Apply
3. Cluster ACTIVE 待機
4. NodeGroup ACTIVE 待機
5. ASG Instance READY 待機
6. Bastion SSM Online (Private EKS のみ)
7. Kubernetes Configuration
8. Kubernetes Node Ready
9. Smoke Tests

### cli/terraform/destroy.ts

EKS クラスタの破棄。依存リソースのクリーンアップ後に Terraform destroy 実行。

```bash
npx tsx cli/terraform/destroy.ts [--dry-run] [--skip-k8s] [--skip-terraform] [--force]
```

### cli/kubernetes/deploy.ts

Kubernetes リソースのデプロイ管理。

```bash
npx tsx cli/kubernetes/deploy.ts app [options]      # Hono アプリデプロイ
npx tsx cli/kubernetes/deploy.ts mlops [options]    # MLOps リソースデプロイ
npx tsx cli/kubernetes/deploy.ts gpu [step]         # GPU/LLM インフラデプロイ
npx tsx cli/kubernetes/deploy.ts status             # 全体ステータス表示
```

### tools/kubernetes/debug.ts

Kubernetes クラスタのデバッグ・調査ツール。

```bash
npx tsx tools/kubernetes/debug.ts nodes             # ノード状態・リソース表示
npx tsx tools/kubernetes/debug.ts pods              # 全 Pod 一覧
npx tsx tools/kubernetes/debug.ts logs <name> [-f]  # Pod ログ表示
npx tsx tools/kubernetes/debug.ts gpu               # GPU ノード・Pod 表示
```

### tools/kubernetes/kind.ts

ローカル Kind クラスタの管理。

```bash
npx tsx tools/kubernetes/kind.ts create            # Kind クラスタ作成
npx tsx tools/kubernetes/kind.ts delete            # Kind クラスタ削除
npx tsx tools/kubernetes/kind.ts deploy            # アプリデプロイ
npx tsx tools/kubernetes/kind.ts logs              # ログ表示
```

### tools/bastion/connect.ts

Bastion ホストへの SSM Session Manager 接続ツール。

```bash
npx tsx tools/bastion/connect.ts connect               # SSM セッション開始
npx tsx tools/bastion/connect.ts status                # Bastion 状態確認
npx tsx tools/bastion/connect.ts exec "kubectl get nodes"  # コマンド実行
```

---

## レイヤー詳細

### Domain Layer (`domain/`)

ビジネスルールとエンティティを定義。外部依存なし。

| モジュール | 説明 |
|-----------|------|
| `cluster/EksCluster.ts` | EKS クラスタエンティティ |
| `database/Database.ts` | データベースエンティティ |
| `valueObjects/Region.ts` | AWS リージョン値オブジェクト |
| `valueObjects/Overlay.ts` | Kustomize オーバーレイ値オブジェクト |
| `valueObjects/Phase.ts` | デプロイフェーズ値オブジェクト |

### UseCase Layer (`usecases/`)

アプリケーション固有のビジネスロジック。

| モジュール | 説明 |
|-----------|------|
| `cluster/ProvisionCluster.ts` | EKS クラスタプロビジョニング |
| `cluster/DestroyCluster.ts` | EKS クラスタ破棄 |
| `cluster/QueryClusterStatus.ts` | クラスタ状態クエリ |
| `deployment/DeployApp.ts` | アプリケーションデプロイ |
| `deployment/DeployMLOps.ts` | MLOps リソースデプロイ |
| `deployment/DeployGPU.ts` | GPU/LLM スタックデプロイ |
| `deployment/DeployAll.ts` | 全フェーズ一括デプロイ |
| `database/ManageDatabase.ts` | CNPG データベース管理 |
| `mlops/ManageMLOps.ts` | MLOps ジョブ管理 |
| `mlops/BuildMLOps.ts` | MLOps イメージビルド |

### Infrastructure Layer (`infrastructure/`)

外部システムとの連携。

| モジュール | 説明 |
|-----------|------|
| `aws/api/` | ECR, EKS, S3, Secrets Manager (stateless query functions) |
| `aws/operations/` | ResourceCleaner, S3Uploader, SSMDiagnostics (stateful ops) |
| `aws/runtime/` | SSMCommandRunner (command execution) |
| `kubernetes/deploy/` | ManifestDeployer, HelmDeployer, AppManifestDeployer, MLOpsManifestDeployer, GPUStackDeployer, ALBControllerDeployer |
| `kubernetes/monitor/` | ClusterMonitor, NodeGroupMonitor, ASGMonitor, BastionMonitor, KubernetesMonitor |
| `kubernetes/manifest/` | engine, renderer, templates/ (K8s manifest rendering) |
| `shell/exec.ts` | シェルコマンド実行 (run, aws, runStreaming) |
| `terraform/` | Terraform 出力取得, TerraformRunner, OrphanCleaner |
| `types.ts` | 外部境界型 + Zod スキーマ |

### Framework Layer (`framework/`)

再利用可能な共通基盤。

| モジュール | 説明 |
|-----------|------|
| `command/InfraCommand.ts` | CLI 基底クラス |
| `command/AwsCommand.ts` | AWS CLI 基底クラス |
| `errors/InfraError.ts` | 構造化エラークラス |
| `errors/retry.ts` | リトライヘルパー (withRetry) |
| `lifecycle/PreflightChecker.ts` | 前提条件チェッカー |
| `lifecycle/Poller.ts` | ポーリングユーティリティ |
| `logging/` | ロガー (log, colors, FileLogger) |
| `narrative/` | CLI 出力標準化 (起承転結) |
| `utils/` | フォーマット, マスキング, バリデーション |
| `types.ts` | 内部フレームワーク型 |

---

## エラーハンドリング

### InfraError (構造化エラー)

```typescript
import { InfraError } from '../framework/errors/InfraError.js';

throw new InfraError('Failed to describe cluster', {
  region: 'ap-northeast-1',
  cluster: 'my-cluster',
  operation: 'eks:DescribeCluster',
});
```

### withRetry (リトライヘルパー)

```typescript
import { withRetry } from '../framework/errors/retry.js';

const result = await withRetry(
  () => eksDescribeCluster(clusterName),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffFactor: 2,
    isRetryable: (e) => e.message.includes('throttl'),
  }
);
```

---

## 設定 (config/)

### createConfig()

Terraform 出力と環境変数から設定を読み込み:

```typescript
import { createConfig, TIMEOUTS, POLL_INTERVALS } from '../config/index.js';

const config = createConfig();
const clusterName = config.require('clusterName');  // throws if missing
config.validate(['clusterName', 'region']);         // validate multiple keys
```

### 定数

| 定数 | 内容 |
|------|------|
| `TIMEOUTS` | cluster, nodeGroup, bastion, kubernetes, terraform 各操作のタイムアウト (ms) |
| `POLL_INTERVALS` | external(20s), internal(60s), bastion(15s), deletion(10s) |
| `PATHS` | プロジェクト、Terraform、K8s パス |

---

## 前提条件

- Node.js 18+
- AWS CLI 設定済み (`aws configure`)
- 適切な IAM 権限
- (EKS 操作時) kubectl, helm

---

*最終更新: 2026-01-03*
