/**
 * =============================================================================
 * Narrative Framework - Public API
 * =============================================================================
 *
 * CLI出力を「起承転結」で標準化するフレームワーク。
 *
 * Usage:
 *   import { showContext, showPreflightSummary, showOutcome } from '../framework/narrative/index.js';
 *
 *   // 起 (Context)
 *   showContext('eks-deploy', { region: 'ap-northeast-1', clusterName: 'prod-eks' });
 *
 *   // 承 (Preflight)
 *   showPreflightSummary({ results: [...] });
 *
 *   // 転 (Action) - 既存のlog.phase(), log.status()を使用
 *
 *   // 結 (Outcome)
 *   showOutcome({ success: true, nextStepsPhaseId: 'eks-deploy' });
 *
 * =============================================================================
 */

// Types
export type {
  // Narrative
  ContextConfig,
  ContextItem,
  PreflightCheckResult,
  PreflightSummaryConfig,
  OutcomeConfig,
  ResourceInfo,
  CommandId,
  PhaseId,
  // Timer
  PhaseTime,
  TimerResult,
  TimerHistoryEntry,
  TimerStats,
} from './types.js';

// Context (起)
export { showContext, buildContextConfig } from './context.js';

// Preflight (承)
export { showPreflightSummary, createPreflightResult } from './preflight-display.js';

// Outcome (結)
export { showOutcome, showSimpleOutcome } from './outcome.js';

// Next Steps (結の一部)
export { showNextSteps, NEXT_STEPS } from './next-steps.js';

// Timer (時間計測)
export { Timer, TimerHistory, formatPhaseDuration } from './timer.js';

// Templates
export { CONTEXT_TEMPLATES } from './data/context-templates.js';
export type { ContextTemplate } from './data/context-templates.js';
