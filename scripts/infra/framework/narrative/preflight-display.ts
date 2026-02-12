/**
 * =============================================================================
 * Preflight Display - 承（前提条件チェック結果サマリ）
 * =============================================================================
 *
 * PreflightCheckerと併用して、チェック結果のサマリを表示。
 *
 * Usage:
 *   const results: PreflightCheckResult[] = [];
 *   results.push({ name: 'AWS CLI', passed: true, detail: 'Account: 123456' });
 *   results.push({ name: 'Bastion', passed: false, error: 'Not found' });
 *   showPreflightSummary({ results });
 *
 * =============================================================================
 */

import { c } from '../logging/index.js';
import type { PreflightSummaryConfig, PreflightCheckResult } from './types.js';

// ============================================================
// Public API
// ============================================================

/**
 * 承（Preflight）- チェック結果サマリを表示
 *
 * @param config - Preflight結果サマリ設定
 */
export function showPreflightSummary(config: PreflightSummaryConfig): void {
  if (config.results.length === 0) return;

  console.log('');
  console.log(c.bold('Preflight Summary:'));

  const maxNameLen = Math.max(...config.results.map(r => r.name.length));

  for (const result of config.results) {
    const name = result.name.padEnd(maxNameLen);
    const icon = result.passed ? c.green('✓') : c.red('✗');
    const detail = result.passed
      ? result.detail
        ? c.dim(`(${result.detail})`)
        : ''
      : result.error
        ? c.red(result.error)
        : c.red('Failed');

    console.log(`  ${icon} ${name}  ${detail}`);
  }

  console.log('');
}

/**
 * Preflightチェック結果を構築するヘルパー
 *
 * @param name - チェック名
 * @param passed - 成否
 * @param detailOrError - 成功時は詳細、失敗時はエラー
 */
export function createPreflightResult(
  name: string,
  passed: boolean,
  detailOrError?: string
): PreflightCheckResult {
  return {
    name,
    passed,
    ...(passed ? { detail: detailOrError } : { error: detailOrError }),
  };
}
