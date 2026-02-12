/**
 * Smoke Test Factory Helpers
 *
 * Provides helper functions to reduce boilerplate in smoke tests.
 */

import type { SmokeResult, SmokeStatus } from './types.js';

// ============================================================
// Smoke Result Builder
// ============================================================

/**
 * Options for smoke test check function.
 */
export interface SmokeCheckResult {
  status: SmokeStatus;
  message: string;
  detail?: unknown;
}

/**
 * Factory function to create a smoke test with consistent timing and error handling.
 *
 * @example
 * export const awsSmoke = createSmoke('aws', async () => {
 *   const accountId = awsGetAccountId();
 *   if (!accountId) {
 *     return { status: 'fail', message: 'AWS credentials not configured' };
 *   }
 *   return { status: 'ok', message: `Account ${accountId}` };
 * });
 */
export function createSmoke(
  name: string,
  checkFn: () => Promise<SmokeCheckResult> | SmokeCheckResult
): () => Promise<SmokeResult> {
  return async (): Promise<SmokeResult> => {
    const start = Date.now();
    try {
      const result = await checkFn();
      return {
        name,
        status: result.status,
        message: result.message,
        detail: result.detail,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      return {
        name,
        status: 'fail',
        message: `${name} check failed`,
        detail: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - start,
      };
    }
  };
}

// ============================================================
// Result Helpers
// ============================================================

/**
 * Create an OK result.
 */
export function ok(message: string, detail?: unknown): SmokeCheckResult {
  return { status: 'ok', message, detail };
}

/**
 * Create a warning result.
 */
export function warn(message: string, detail?: unknown): SmokeCheckResult {
  return { status: 'warn', message, detail };
}

/**
 * Create a failure result.
 */
export function fail(message: string, detail?: unknown): SmokeCheckResult {
  return { status: 'fail', message, detail };
}

// ============================================================
// Conditional Helpers
// ============================================================

/**
 * Return fail if condition is false, otherwise continue.
 * Useful for validation chains.
 *
 * @example
 * const accountId = awsGetAccountId();
 * const check = require(accountId, 'AWS credentials not configured');
 * if (check) return check;
 * // ... continue with accountId
 */
export function require(
  value: unknown,
  failMessage: string
): SmokeCheckResult | null {
  if (!value) {
    return fail(failMessage);
  }
  return null;
}

/**
 * Return warn if condition is false, otherwise continue.
 */
export function requireOrWarn(
  value: unknown,
  warnMessage: string
): SmokeCheckResult | null {
  if (!value) {
    return warn(warnMessage);
  }
  return null;
}
