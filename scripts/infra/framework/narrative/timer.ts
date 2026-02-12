/**
 * =============================================================================
 * Timer - 実行時間計測クラス
 * =============================================================================
 *
 * CLI コマンドの実行時間を計測し、フェーズ別の内訳を記録。
 * JSON ファイルへの履歴保存・統計機能をサポート。
 *
 * Usage:
 *   const timer = new Timer('eks-deploy').start();
 *
 *   timer.phase('terraform-apply');
 *   await runTerraform();
 *   timer.endPhase();
 *
 *   timer.phase('node-ready');
 *   await waitForNodes();
 *   timer.endPhase();
 *
 *   const result = timer.stop(true);
 *   timer.save();  // 履歴保存
 *   showOutcome({ ...result });
 *
 *   // 統計表示
 *   const stats = TimerHistory.getStats('eks-deploy');
 *
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type { PhaseTime, TimerResult, TimerHistoryEntry, TimerStats } from './types.js';
import { formatDuration, formatMs } from './utils/duration.js';

// Re-export types and utilities
export type { PhaseTime, TimerResult, TimerHistoryEntry, TimerStats };
export { formatPhaseDuration } from './utils/duration.js';

// ============================================================
// Timer Class
// ============================================================

/**
 * 実行時間計測クラス
 *
 * フェーズ別の時間計測をサポートし、narrative フレームワークと連携。
 */
export class Timer {
  private commandId: string;
  private _startTime: number = 0;
  private _endTime: number = 0;
  private phases: PhaseTime[] = [];
  private currentPhase: PhaseTime | null = null;
  private _success: boolean = true;
  private _lastResult: TimerResult | null = null;

  constructor(commandId: string) {
    this.commandId = commandId;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * 計測開始
   */
  start(): this {
    this._startTime = Date.now();
    return this;
  }

  /**
   * 計測終了
   * @param success - 成功/失敗フラグ（デフォルト: true）
   */
  stop(success: boolean = true): TimerResult {
    // 未終了のフェーズを終了
    if (this.currentPhase) {
      this.endPhase();
    }

    this._endTime = Date.now();
    this._success = success;

    this._lastResult = {
      commandId: this.commandId,
      startTime: this._startTime,
      endTime: this._endTime,
      duration: this._endTime - this._startTime,
      phases: this.phases,
      success: this._success,
    };

    return this._lastResult;
  }

  /**
   * 計測結果を履歴ファイルに保存
   * stop() を呼んだ後に使用
   */
  save(): void {
    if (!this._lastResult) {
      throw new Error('Timer.save() called before stop()');
    }
    TimerHistory.append(this._lastResult);
  }

  // ============================================================
  // Phase Tracking
  // ============================================================

  /**
   * 新しいフェーズを開始
   * @param name - フェーズ名
   */
  phase(name: string): this {
    // 前のフェーズを終了
    if (this.currentPhase) {
      this.endPhase();
    }

    this.currentPhase = {
      name,
      startTime: Date.now(),
    };

    return this;
  }

  /**
   * 現在のフェーズを終了
   */
  endPhase(): this {
    if (this.currentPhase) {
      const endTime = Date.now();
      this.currentPhase.endTime = endTime;
      this.currentPhase.duration = endTime - this.currentPhase.startTime;
      this.phases.push(this.currentPhase);
      this.currentPhase = null;
    }

    return this;
  }

  // ============================================================
  // Getters
  // ============================================================

  /**
   * 開始時刻を取得
   */
  get startTime(): number {
    return this._startTime;
  }

  /**
   * 経過時間を取得 (ms)
   */
  elapsed(): number {
    return Date.now() - this._startTime;
  }

  /**
   * 経過時間をフォーマット済み文字列で取得
   */
  elapsedFormatted(): string {
    return formatDuration(this._startTime);
  }

  /**
   * フェーズ一覧を取得
   */
  getPhases(): PhaseTime[] {
    return [...this.phases];
  }
}

// ============================================================
// Timer History - 履歴管理
// ============================================================

/** 履歴ファイルの最大エントリ数 */
const MAX_HISTORY_ENTRIES = 100;

/**
 * タイマー履歴管理クラス
 *
 * JSON ファイルに実行履歴を保存し、統計情報を提供。
 */
export class TimerHistory {
  /** デフォルトの履歴ファイルパス */
  static readonly DEFAULT_PATH = path.join(os.homedir(), '.eks-mlops', 'timing-history.json');

  /**
   * 履歴ファイルのパスを取得
   */
  static getPath(): string {
    return process.env.TIMER_HISTORY_PATH || TimerHistory.DEFAULT_PATH;
  }

  /**
   * 履歴を読み込み
   */
  static load(): TimerHistoryEntry[] {
    const filePath = TimerHistory.getPath();

    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as { history?: TimerHistoryEntry[] };
      return data.history || [];
    } catch {
      return [];
    }
  }

  /**
   * 履歴に追加
   */
  static append(result: TimerResult): void {
    const filePath = TimerHistory.getPath();
    const dir = path.dirname(filePath);

    // ディレクトリ作成
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 既存履歴を読み込み
    let history = TimerHistory.load();

    // 新しいエントリを追加
    const entry: TimerHistoryEntry = {
      ...result,
      timestamp: new Date(result.startTime).toISOString(),
    };
    history.push(entry);

    // 最大数を超えたら古いものを削除
    if (history.length > MAX_HISTORY_ENTRIES) {
      history = history.slice(-MAX_HISTORY_ENTRIES);
    }

    // 保存
    fs.writeFileSync(filePath, JSON.stringify({ history }, null, 2), 'utf-8');
  }

  /**
   * 特定コマンドの履歴を取得
   */
  static getByCommand(commandId: string, limit?: number): TimerHistoryEntry[] {
    const history = TimerHistory.load();
    const filtered = history.filter(e => e.commandId === commandId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * 統計情報を取得
   */
  static getStats(commandId: string): TimerStats | null {
    const entries = TimerHistory.getByCommand(commandId);

    if (entries.length === 0) {
      return null;
    }

    const durations = entries.map(e => e.duration);
    const successCount = entries.filter(e => e.success).length;

    return {
      commandId,
      count: entries.length,
      successCount,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastRun: entries[entries.length - 1],
    };
  }

  /**
   * 統計情報をフォーマット済み文字列で取得
   */
  static formatStats(commandId: string): string | null {
    const stats = TimerHistory.getStats(commandId);

    if (!stats) {
      return null;
    }

    return [
      `${commandId} Statistics (${stats.count} runs):`,
      `  Average: ${formatMs(stats.avgDuration)}`,
      `  Min:     ${formatMs(stats.minDuration)}`,
      `  Max:     ${formatMs(stats.maxDuration)}`,
      `  Success: ${stats.successCount}/${stats.count} (${Math.round(stats.successCount / stats.count * 100)}%)`,
    ].join('\n');
  }

  /**
   * 履歴をクリア
   */
  static clear(): void {
    const filePath = TimerHistory.getPath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
