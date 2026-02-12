/**
 * =============================================================================
 * Narrative Framework - Type Definitions
 * =============================================================================
 *
 * CLI出力を「起承転結」で標準化するための型定義。
 *
 *   - 起（Context）: 実行開始時の状況表示
 *   - 承（Preflight）: 前提条件チェック結果
 *   - 転（Action）: 実行本体の進捗 (既存のlog.phase/statusを使用)
 *   - 結（Outcome）: 結果表示とNext Steps
 *
 * =============================================================================
 */

import type { PhaseId } from './next-steps.js';

// ============================================================
// Timer 関連型
// ============================================================

/**
 * フェーズ別計測結果
 */
export interface PhaseTime {
  /** フェーズ名 */
  name: string;
  /** 開始時刻 (ms) */
  startTime: number;
  /** 終了時刻 (ms) */
  endTime?: number;
  /** 経過時間 (ms) */
  duration?: number;
}

/**
 * Timer 計測結果
 */
export interface TimerResult {
  /** コマンドID */
  commandId: string;
  /** 開始時刻 (ms) */
  startTime: number;
  /** 終了時刻 (ms) */
  endTime: number;
  /** 経過時間 (ms) */
  duration: number;
  /** フェーズ別計測結果 */
  phases: PhaseTime[];
  /** 成功/失敗 */
  success: boolean;
}

/**
 * 履歴エントリ（保存用）
 */
export interface TimerHistoryEntry extends TimerResult {
  /** ISO 8601 タイムスタンプ */
  timestamp: string;
}

/**
 * 統計情報
 */
export interface TimerStats {
  /** コマンドID */
  commandId: string;
  /** サンプル数 */
  count: number;
  /** 成功数 */
  successCount: number;
  /** 平均時間 (ms) */
  avgDuration: number;
  /** 最短時間 (ms) */
  minDuration: number;
  /** 最長時間 (ms) */
  maxDuration: number;
  /** 直近の実行 */
  lastRun?: TimerHistoryEntry;
}

// ============================================================
// 起 (Context) - 実行開始時の状況表示
// ============================================================

/**
 * コンテキスト表示項目
 */
export interface ContextItem {
  /** 表示ラベル (e.g., "Region", "Cluster") */
  label: string;
  /** 表示値 (e.g., "ap-northeast-1", "prod-eks-cluster") */
  value: string | null;
}

/**
 * コンテキスト設定
 */
export interface ContextConfig {
  /** ヘッダータイトル (e.g., "EKS Infrastructure Deploy") */
  title: string;
  /** 表示項目リスト */
  items: ContextItem[];
  /** 実行モード (e.g., "Dry-Run", "Production") */
  mode?: string;
  /** 推定所要時間 */
  estimate?: {
    /** 推定合計秒数 */
    totalSeconds: number;
    /** 内訳 (オプション) */
    breakdown?: { label: string; seconds: number }[];
  };
}

// ============================================================
// 承 (Preflight) - 前提条件チェック結果
// ============================================================

/**
 * Preflightチェック結果
 */
export interface PreflightCheckResult {
  /** チェック名 (e.g., "AWS CLI", "Credentials") */
  name: string;
  /** 成否 */
  passed: boolean;
  /** 詳細（成功時の追加情報） */
  detail?: string;
  /** エラー（失敗時のメッセージ） */
  error?: string;
}

/**
 * Preflight結果サマリ設定
 */
export interface PreflightSummaryConfig {
  /** チェック結果リスト */
  results: PreflightCheckResult[];
}

// ============================================================
// 結 (Outcome) - 結果表示とNext Steps
// ============================================================

/**
 * リソース情報（結果表示用）
 */
export interface ResourceInfo {
  /** リソースタイプ (e.g., "Pod", "Node", "Cluster") */
  type: string;
  /** リソース名 */
  name: string;
  /** ステータス */
  status: 'ready' | 'pending' | 'error' | 'unknown';
  /** 追加詳細 */
  details?: string;
}

/**
 * Outcome（結果）設定
 */
export interface OutcomeConfig {
  /** 成功/失敗 */
  success: boolean;
  /** カスタムタイトル (デフォルト: "Deployment Complete" / "Deployment Failed") */
  title?: string;
  /** 実行時間 */
  duration?: {
    /** 開始時刻 (Date.now()) */
    startTime: number;
    /** 終了時刻 (省略時はDate.now()) */
    endTime?: number;
  };
  /** 作成/更新されたリソース */
  resources?: ResourceInfo[];
  /** カスタムサマリ項目 */
  summary?: { label: string; value: string }[];
  /** next-steps.tsのPhaseId */
  nextStepsPhaseId?: PhaseId;
  /** ログファイルパス */
  logPath?: string;
  /** フェーズ別時間内訳 */
  phases?: PhaseTime[];
}

// ============================================================
// コマンド識別子
// ============================================================

/**
 * コマンドID（テンプレート識別用）
 */
export type CommandId =
  // Terraform
  | 'eks-deploy'
  // Kubernetes
  | 'k8s-deploy'
  | 'k8s-deploy-mlops'
  | 'k8s-deploy-gpu'
  | 'k8s-init'
  // Database
  | 'db-deploy'
  | 'db-migrate'
  | 'db-seed'
  | 'secrets-create'
  | 'auth-setup'
  // Bastion
  | 'bastion-connect'
  | 'bastion-status'
  | 'bastion-setup'
  // MLOps
  | 'mlops-deploy'
  | 'mlops-build'
  | 'mlops-push'
  | 'mlops-job'
  // Smoke
  | 'smoke-test';

// Re-export for convenience
export type { PhaseId };
