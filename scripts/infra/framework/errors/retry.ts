/**
 * Retry utilities with exponential backoff.
 */

import { sleep } from '../../infrastructure/shell/index.js';
import type { WithRetryOptions } from '../types.js';

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * @example
 * const result = await withRetry(
 *   () => eksDescribeCluster(clusterName),
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => log.warn(`Retry ${attempt}: ${error.message}`),
 *   }
 * );
 *
 * @example
 * // Only retry on specific errors
 * await withRetry(
 *   () => fetchWithTimeout(url),
 *   {
 *     isRetryable: (error) => error.message.includes('timeout'),
 *   }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffFactor = 2,
    maxDelayMs = 30000,
    onRetry,
    isRetryable = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      lastError = error;

      // Check if we've exhausted retries or error is not retryable
      if (attempt > maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate next delay with exponential backoff
      const nextDelay = Math.min(delay, maxDelayMs);

      // Notify caller about retry
      if (onRetry) {
        onRetry(attempt, error, nextDelay);
      }

      // Wait before next attempt
      await sleep(nextDelay);

      // Increase delay for next iteration
      delay = delay * backoffFactor;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error('withRetry failed');
}

