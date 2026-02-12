/**
 * =============================================================================
 * Context Display - 起（実行開始時の状況表示）
 * =============================================================================
 *
 * CLI実行開始時のコンテキスト情報を表示。
 *
 * Usage:
 *   showContext('eks-deploy', { region: 'ap-northeast-1', clusterName: 'prod-eks' });
 *   showContext({ title: 'Custom', items: [{ label: 'Key', value: 'Value' }] });
 *
 * =============================================================================
 */

import { c } from '../logging/index.js';
import type { ContextConfig, ContextItem, CommandId } from './types.js';
import { CONTEXT_TEMPLATES, type ContextTemplate } from './data/context-templates.js';

// ============================================================
// Constants
// ============================================================

const BORDER_CHAR = '━';
const BORDER_WIDTH = 50;

// ============================================================
// Internal Helpers
// ============================================================

/**
 * ボーダーラインを生成
 */
function border(): string {
  return c.yellow(BORDER_CHAR.repeat(BORDER_WIDTH));
}

/**
 * 時刻をフォーマット (HH:MM:SS)
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 秒数を「約N分」形式に変換
 */
function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `約${minutes}分`;
}

/**
 * テンプレート内の変数を置換
 */
function resolveVariables(
  template: ContextTemplate,
  variables: Record<string, string | null>
): ContextConfig {
  const items: ContextItem[] = (template.items || []).map(item => ({
    label: item.label,
    value: item.value?.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '-') ?? null,
  }));

  return {
    title: template.title,
    items,
    mode: template.mode,
    estimate: template.estimate,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * コンテキスト設定を構築（テンプレートから）
 */
export function buildContextConfig(
  commandId: CommandId,
  variables: Record<string, string | null>
): ContextConfig {
  const template = CONTEXT_TEMPLATES[commandId];
  if (!template) {
    throw new Error(`Unknown command ID: ${commandId}`);
  }
  return resolveVariables(template, variables);
}

/**
 * 起（Context）- 実行開始時の状況を表示
 *
 * @param configOrId - ContextConfig または CommandId
 * @param variables - テンプレート変数（CommandId使用時）
 */
export function showContext(
  configOrId: ContextConfig | CommandId,
  variables?: Record<string, string | null>
): void {
  // Resolve config
  const config: ContextConfig =
    typeof configOrId === 'string'
      ? buildContextConfig(configOrId, variables || {})
      : configOrId;

  const now = new Date();

  // Header
  console.log('');
  console.log(border());
  console.log(`  ${c.bold(config.title)}`);
  console.log(border());

  // Items
  const maxLabelLen = Math.max(...config.items.map(i => i.label.length));
  for (const item of config.items) {
    const label = item.label.padEnd(maxLabelLen);
    const value = item.value ?? c.dim('-');
    console.log(`  ${label}:  ${c.cyan(value)}`);
  }

  // Mode (if specified)
  if (config.mode) {
    console.log(`  ${'Mode'.padEnd(maxLabelLen)}:  ${c.yellow(config.mode)}`);
  }

  // Estimate
  if (config.estimate) {
    console.log(border());
    const estimatedEnd = new Date(now.getTime() + config.estimate.totalSeconds * 1000);

    console.log(`  ${c.dim('開始時刻:')}       ${formatTime(now)}`);
    console.log(
      `  ${c.dim('推定完了時刻:')}   ${c.bold(formatTime(estimatedEnd))} ${c.dim(`(${formatMinutes(config.estimate.totalSeconds)}後)`)}`
    );

    // Breakdown
    if (config.estimate.breakdown && config.estimate.breakdown.length > 0) {
      for (const step of config.estimate.breakdown) {
        console.log(`    ${c.dim('└')} ${step.label}: ${formatMinutes(step.seconds)}`);
      }
    }
  }

  console.log(border());
  console.log('');
}
