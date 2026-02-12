/**
 * =============================================================================
 * Next Steps - 誘導コメント表示ユーティリティ
 * =============================================================================
 *
 * 各コマンド完了後の「次のステップ」誘導コメントを一元管理。
 * README (README Make EKS MLops.md) の Phase 構成に準拠。
 *
 * Usage:
 *   import { showNextSteps } from '../framework/narrative/next-steps.js';
 *   showNextSteps('db-deploy');
 *
 * =============================================================================
 */

import { c } from '../logging/index.js';

// ============================================================
// Types
// ============================================================

/**
 * Phase 識別子（コマンド完了後のポイント）
 */
export type PhaseId =
  | 'eks-deploy'      // Phase 3 完了後 → Phase 3.5 Bastion Setup
  | 'db-deploy'       // Phase 6 db-deploy 完了後
  | 'secrets-create'  // Phase 6 secrets-create 完了後 → Phase 7
  | 'k8s-deploy'      // Phase 7 完了後 → Phase 8
  | 'db-migrate'      // Phase 8 migrate 完了後
  | 'db-seed'         // Phase 8 seed 完了後
  | 'auth-setup'      // Phase 8 auth-setup 完了後 → Phase 9, 10
  | 'mlops-deploy';   // Phase 10 deploy 完了後

interface NextStep {
  command: string;     // e.g. 'make eks-db-deploy'
  description: string; // e.g. 'シードデータ投入' (empty string if none)
}

export interface PhaseNextSteps {
  title?: string;      // e.g. 'Phase 8: Post-Deploy' (omit for simple 'Next Steps:')
  steps: NextStep[];
  then?: {             // Additional guidance section (optional)
    title: string;
    steps: NextStep[];
  };
}

// ============================================================
// Next Steps Configuration (README準拠)
// ============================================================

/**
 * 誘導コメント定義
 * READMEのPhase構成:
 *   Phase 1: AWS認証確認
 *   Phase 2: Shared インフラ + ECR
 *   Phase 3: EKS インフラ構築
 *   Phase 3.5: Bastion セットアップ
 *   Phase 4: Namespace + ServiceAccount
 *   Phase 5: Observability 初期確認
 *   Phase 6: Database デプロイ
 *   Phase 7: App デプロイ
 *   Phase 8: Post-Deploy
 *   Phase 9: 最終検証
 *   Phase 10: MLOps Pipeline
 */
export const NEXT_STEPS: Record<PhaseId, PhaseNextSteps> = {
  // Phase 3 完了後 → Phase 3.5 + Phase 4
  'eks-deploy': {
    title: 'Phase 3.5: Bastion Setup',
    steps: [
      { command: 'make eks-bastion-status', description: 'SSM Agent Online 確認' },
      { command: 'make eks-bastion-setup', description: 'kubectl/helm セットアップ' },
      { command: 'make eks-sync', description: 'ワークスペース同期' },
    ],
    then: {
      title: 'Phase 4',
      steps: [
        { command: 'make eks-k8s-init', description: 'Namespace + ServiceAccount 作成' },
      ],
    },
  },

  // Phase 6 db-deploy 完了後
  'db-deploy': {
    steps: [
      { command: 'make eks-secrets-create', description: 'app-backend-secrets 作成' },
      { command: 'make eks-db-status', description: '状態確認' },
    ],
  },

  // Phase 6 secrets-create 完了後 → Phase 7
  'secrets-create': {
    title: 'Phase 7: App Deploy',
    steps: [
      { command: 'export K8S_OVERLAY=prod', description: '' },
      { command: 'make eks-k8s-deploy', description: 'Frontend + Backend デプロイ' },
    ],
  },

  // Phase 7 完了後 → Phase 8
  'k8s-deploy': {
    title: 'Phase 8: Post-Deploy',
    steps: [
      { command: 'make eks-db-migrate', description: 'Prisma マイグレーション' },
      { command: 'make eks-db-seed', description: 'シードデータ投入' },
      { command: 'make eks-auth-setup', description: 'AUTH_SERVICE_URL 設定' },
    ],
    then: {
      title: 'Phase 9: Verify',
      steps: [
        { command: 'make eks-verify', description: '' },
      ],
    },
  },

  // Phase 8 migrate 完了後
  'db-migrate': {
    steps: [
      { command: 'make eks-db-seed', description: 'シードデータ投入' },
    ],
  },

  // Phase 8 seed 完了後
  'db-seed': {
    steps: [
      { command: 'make eks-auth-setup', description: 'AUTH_SERVICE_URL 設定' },
    ],
  },

  // Phase 8 auth-setup 完了後 → Phase 9 + Phase 10
  'auth-setup': {
    title: 'Phase 9: Verify',
    steps: [
      { command: 'make eks-verify', description: 'Health + Login 検証' },
      { command: 'make eks-smoke-strict', description: 'Smoke テスト (CI)' },
    ],
    then: {
      title: 'Phase 10: MLOps',
      steps: [
        { command: 'make mlops-build && make mlops-push', description: '' },
        { command: 'make mlops-deploy', description: '' },
        { command: 'make mlops-e2e-analytics', description: '' },
      ],
    },
  },

  // Phase 10 mlops-deploy 完了後
  'mlops-deploy': {
    steps: [
      { command: 'make mlops-status', description: '状態確認' },
      { command: 'make mlops-e2e-analytics', description: 'E2Eパイプライン実行 (推奨)' },
    ],
    then: {
      title: 'または個別実行',
      steps: [
        { command: 'make mlops-job JOB=generate', description: '' },
      ],
    },
  },
};

// ============================================================
// Display Function
// ============================================================

/**
 * Next Steps 誘導コメントを表示
 * @param phaseId - Phase識別子
 */
export function showNextSteps(phaseId: PhaseId): void {
  const config = NEXT_STEPS[phaseId];
  if (!config) return;

  console.log('');

  // Main section
  const title = config.title ? `Next Steps (${config.title}):` : 'Next Steps:';
  console.log(c.bold(title));

  for (const step of config.steps) {
    const desc = step.description ? `  # ${step.description}` : '';
    console.log(`  ${c.cyan(step.command)}${desc}`);
  }

  // Then section (optional)
  if (config.then) {
    console.log('');
    console.log(c.bold(`Then (${config.then.title}):`));
    for (const step of config.then.steps) {
      const desc = step.description ? `  # ${step.description}` : '';
      console.log(`  ${c.cyan(step.command)}${desc}`);
    }
  }
}
