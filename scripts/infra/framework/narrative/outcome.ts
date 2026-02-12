/**
 * =============================================================================
 * Outcome Display - 結（結果表示とNext Steps）
 * =============================================================================
 *
 * CLI実行完了時の結果サマリとNext Stepsを表示。
 *
 * Usage:
 *   showOutcome({
 *     success: true,
 *     duration: { startTime },
 *     resources: [{ type: 'Node', name: 'ip-10-0-1-1', status: 'ready' }],
 *     nextStepsPhaseId: 'eks-deploy',
 *   });
 *
 *   showSimpleOutcome(true, 'Database deployed successfully', 'db-deploy');
 *
 * =============================================================================
 */

import { c } from '../logging/index.js';
import { showNextSteps } from './next-steps.js';
import { formatDuration, formatPhaseDuration } from './utils/duration.js';
import type { OutcomeConfig, ResourceInfo, PhaseId } from './types.js';

// ============================================================
// Constants
// ============================================================

const BORDER_CHAR = '═';
const BORDER_WIDTH = 65;

// ============================================================
// Internal Helpers
// ============================================================

/**
 * ボーダーラインを生成
 */
function border(): string {
  return c.cyan(BORDER_CHAR.repeat(BORDER_WIDTH));
}

/**
 * リソースステータスのアイコンを取得
 */
function statusIcon(status: ResourceInfo['status']): string {
  switch (status) {
    case 'ready':
      return c.green('✓');
    case 'pending':
      return c.yellow('○');
    case 'error':
      return c.red('✗');
    default:
      return c.dim('?');
  }
}

/**
 * リソースステータスのラベルを取得
 */
function statusLabel(status: ResourceInfo['status']): string {
  switch (status) {
    case 'ready':
      return c.green('Ready');
    case 'pending':
      return c.yellow('Pending');
    case 'error':
      return c.red('Error');
    default:
      return c.dim('Unknown');
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * 結（Outcome）- 結果とNext Stepsを表示
 *
 * @param config - Outcome設定
 */
export function showOutcome(config: OutcomeConfig): void {
  const title = config.title ?? (config.success ? 'Deployment Complete' : 'Deployment Failed');
  const titleColor = config.success ? c.green : c.red;

  console.log('');
  console.log(border());
  console.log(` ${titleColor(c.bold(title))}`);
  console.log(border());

  // Summary items
  if (config.summary && config.summary.length > 0) {
    console.log('');
    console.log(c.bold('Summary:'));
    const maxLabelLen = Math.max(...config.summary.map(s => s.label.length));
    for (const item of config.summary) {
      const label = item.label.padEnd(maxLabelLen);
      console.log(`  ${label}:  ${c.cyan(item.value)}`);
    }
  }

  // Resources
  if (config.resources && config.resources.length > 0) {
    console.log('');
    console.log(c.bold('Resources:'));
    for (const resource of config.resources) {
      const icon = statusIcon(resource.status);
      const label = statusLabel(resource.status);
      const details = resource.details ? c.dim(`(${resource.details})`) : '';
      console.log(`  ${icon} ${resource.type}  ${resource.name}  ${label}  ${details}`);
    }
  }

  // Duration
  if (config.duration) {
    console.log('');
    console.log(`Duration: ${c.bold(formatDuration(config.duration.startTime, config.duration.endTime))}`);

    // Phase breakdown
    if (config.phases && config.phases.length > 0) {
      const maxNameLen = Math.max(...config.phases.map(p => p.name.length));
      for (const phase of config.phases) {
        const name = phase.name.padEnd(maxNameLen);
        const duration = formatPhaseDuration(phase);
        console.log(`  ${c.dim(name)}:  ${duration}`);
      }
    }
  }

  // Log path
  if (config.logPath) {
    console.log(`Log file: ${c.dim(config.logPath)}`);
  }

  // Next Steps
  if (config.nextStepsPhaseId) {
    showNextSteps(config.nextStepsPhaseId);
  }

  console.log('');
}

/**
 * シンプルな結果表示（リソース一覧なし）
 *
 * @param success - 成功/失敗
 * @param message - 表示メッセージ
 * @param nextStepsPhaseId - next-steps.tsのPhaseId
 */
export function showSimpleOutcome(
  success: boolean,
  message: string,
  nextStepsPhaseId?: PhaseId
): void {
  const icon = success ? c.green('✓') : c.red('✗');
  console.log('');
  console.log(`${icon} ${c.bold(message)}`);

  if (nextStepsPhaseId) {
    showNextSteps(nextStepsPhaseId);
  }
}
