/**
 * =============================================================================
 * Duration Utilities - 時間フォーマットユーティリティ
 * =============================================================================
 */

import type { PhaseTime } from '../types.js';

/**
 * ミリ秒を人間可読形式にフォーマット
 * @param ms - ミリ秒
 * @returns フォーマット済み文字列 (e.g., "5m 30s", "45s")
 */
export function formatMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * 開始時刻から経過時間をフォーマット
 * @param startTime - 開始時刻 (Date.now())
 * @param endTime - 終了時刻 (省略時は現在時刻)
 */
export function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime ?? Date.now();
  return formatMs(end - startTime);
}

/**
 * フェーズの経過時間をフォーマット
 */
export function formatPhaseDuration(phase: PhaseTime): string {
  if (phase.duration === undefined) {
    return '-';
  }
  return formatMs(phase.duration);
}
