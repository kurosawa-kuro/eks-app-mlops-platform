# scripts/infra 評価レポート

## 概要

EKS MLOps Platform のデプロイスクリプト群。TypeScript で実装された CLI ツールで、AWS EKS クラスタのプロビジョニング、Kubernetes リソースのデプロイ、MLOps パイプラインの管理を行う。

| 指標 | 値 |
|------|-----|
| TypeScript ファイル数 | 198 |
| 総行数 | ~31,000 行 |
| テストファイル数 | 41 |
| テストケース数 | 434 |
| 依存関係 | 最小限 (awilix, zod のみ) |

---

## 総合評価: A-

| カテゴリ | 評価 | コメント |
|----------|------|----------|
| アーキテクチャ | A | Clean Architecture を採用、レイヤー分離が明確 |
| コード品質 | A- | TypeScript strict、型定義充実、JSDoc 完備 |
| テスト | B+ | 434 テスト、主要パスをカバー、E2E は別途 |
| 保守性 | A | モジュール化、DI、明確な責務分離 |
| ドキュメント | A- | README 充実、コード内コメント豊富 |
| エラーハンドリング | A | 構造化エラー、リトライ、コンテキスト付き |
| セキュリティ | B+ | シークレットマスキング、IAM ベスト慣行 |

---

## 強み

### 1. Clean Architecture の採用

```
domain/         ← ビジネスロジック (外部依存なし)
usecases/       ← アプリケーションロジック
infrastructure/ ← 外部システム連携
framework/      ← 共通基盤
```

**評価**: レイヤー間の依存方向が一貫しており、テスト容易性が高い。UseCases が Phase パターンで構成され、各フェーズが独立してテスト可能。

### 2. 型安全性

```typescript
// Zod による実行時バリデーション + 型推論
const ECRImageArraySchema = z.array(ECRImageSchema);
type ECRImage = z.infer<typeof ECRImageSchema>;

// 値オブジェクトによるドメイン制約
const overlay = Overlay.fromString('prod'); // throws if invalid
```

**評価**: TypeScript strict モード + Zod で型安全を二重に担保。AWS CLI 出力のパースにも型定義を活用。

### 3. 依存性注入 (DI)

```typescript
// Awilix によるコンテナ管理
const container = createInfraContainer();
const useCase = new ProvisionCluster(container);

// テスト時はモック注入
const deps = { run: vi.fn(), log: mockLogger };
const deployer = new ManifestDeployer(config, deps);
```

**評価**: 外部依存 (AWS CLI, kubectl) をモック可能な設計。テストでは実際の API 呼び出しなしに検証可能。

### 4. エラーハンドリング

```typescript
// 構造化エラー
throw new InfraError('Failed to describe cluster', {
  region: 'ap-northeast-1',
  cluster: 'my-cluster',
  operation: 'eks:DescribeCluster',
});

// リトライヘルパー
const result = await withRetry(
  () => eksDescribeCluster(clusterName),
  { maxRetries: 3, backoffFactor: 2 }
);
```

**評価**: コンテキスト付きエラー、AWS エラーコードの抽出、設定可能なリトライ戦略。

### 5. CLI 基底クラス

```typescript
class MyCommand extends InfraCommand {
  static commands = {
    list: { desc: 'List items', aliases: ['ls'] },
    show: { desc: 'Show details', args: '<name>', requireAws: true },
  };
  async cmdList() { ... }
  async cmdShow(name: string) { ... }
}
```

**評価**: 宣言的なコマンド定義、自動ヘルプ生成、プリフライトチェック、統一されたエラーハンドリング。

### 6. Narrative Framework (起承転結)

```typescript
// 起: コンテキスト表示
showContext({ title: 'EKS Cluster Provisioning', ... });

// 承・転: フェーズ実行
for (const phase of phases) {
  showPhaseProgress(phase);
  await phase.execute();
}

// 結: 結果サマリー
showOutcome({ success: true, summary: [...] });
```

**評価**: CLI 出力が構造化され、ユーザーフレンドリー。進捗表示、カラー出力、次のステップ提案。

---

## 改善点

### 1. テストカバレッジ

**現状**: ユニットテスト 434 件。主要パスはカバー。

**改善案**:
- E2E テストの統合 (現在は smoke/ で別管理)
- エッジケース (ネットワークエラー、タイムアウト) のテスト追加
- プロパティベーステストの導入 (fast-check)

### 2. ドキュメント

**現状**: README 充実、JSDoc 完備。

**改善案**:
- アーキテクチャ決定記録 (ADR) の追加
- シーケンス図の追加 (プロビジョニングフロー)
- トラブルシューティングガイドの拡充

### 3. 設定管理

**現状**: Terraform 出力 + 環境変数から設定読み込み。

**改善案**:
- 環境別設定ファイル (config/prod.ts, config/staging.ts)
- 設定スキーマのバリデーション強化
- シークレット管理の明確化 (AWS Secrets Manager 統合)

### 4. ログ管理

**現状**: FileLogger で logs/ に出力、コンソール出力あり。

**改善案**:
- 構造化ログ (JSON 形式) オプション
- ログレベル設定の環境変数化
- ログローテーション設定

### 5. 並列処理

**現状**: フェーズは逐次実行。

**改善案**:
- 独立した操作の並列実行 (Promise.all)
- ワーカースレッドの活用 (重い処理)
- 進捗表示の並列対応

---

## 他プロジェクトとの比較

### vs Pulumi / CDK

| 観点 | scripts/infra | Pulumi/CDK |
|------|---------------|------------|
| 抽象度 | 低 (CLI ラッパー) | 高 (SDK) |
| 学習コスト | 低 | 中〜高 |
| 柔軟性 | 高 | 中 |
| 状態管理 | Terraform 委譲 | 独自 |
| デバッグ | 容易 | やや困難 |

**結論**: 小〜中規模プロジェクトには適切。大規模では Pulumi/CDK の方がメリットが大きい可能性。

### vs Helm + Kustomize のみ

| 観点 | scripts/infra | Helm/Kustomize のみ |
|------|---------------|---------------------|
| オーケストレーション | あり | なし |
| エラーハンドリング | 高度 | 基本 |
| 再試行 | 自動 | 手動 |
| 進捗表示 | 構造化 | 基本 |
| テスト | 充実 | なし |

**結論**: Kubernetes 単体では Helm/Kustomize で十分だが、Terraform + K8s + AWS サービスの統合には本スクリプトの価値がある。

---

## ベストプラクティス準拠

| プラクティス | 準拠 | 備考 |
|--------------|------|------|
| TypeScript strict | ✓ | noImplicitAny, strictNullChecks |
| ESM modules | ✓ | .js 拡張子付き import |
| 単一責任原則 | ✓ | クラス・関数が小さく単機能 |
| 依存性逆転 | ✓ | インターフェースへの依存 |
| 開放閉鎖原則 | ✓ | Phase パターンで拡張可能 |
| DRY | ✓ | 共通処理は framework/ に集約 |
| 適切なエラー伝播 | ✓ | 構造化エラー、コンテキスト付き |
| 設定の外部化 | ✓ | 環境変数、Terraform 出力 |
| シークレット保護 | ✓ | マスキング関数、IAM ロール |
| 冪等性 | ✓ | 再実行可能な設計 |

---

## 推奨アクション

### 短期 (1-2週間)

1. ~~`lib/` ファサードの削除~~ ✅ 完了
2. ~~`infrastructure/` の再構造化~~ ✅ 完了
3. ~~`makefiles/*.mk` のパス修正~~ ✅ 完了

### 中期 (1-2ヶ月)

1. E2E テストの CI 統合
2. 構造化ログの導入
3. 設定スキーマのバリデーション強化

### 長期 (3-6ヶ月)

1. 並列処理の最適化
2. Observability 強化 (OpenTelemetry 統合)
3. マルチクラスター対応

---

## 結論

**scripts/infra は、EKS + K8s + MLOps の統合デプロイに特化した、品質の高いデプロイスクリプト群である。**

Clean Architecture、依存性注入、構造化エラー、テスト容易性など、エンタープライズレベルの設計パターンを採用。小〜中規模のプロジェクトには十分な機能を持ち、拡張性も確保されている。

主な強みは「オペレーターフレンドリー」な設計で、エラー時のデバッグ容易性、再実行可能性、進捗の可視化が優れている。

---

*評価日: 2026-01-03*
