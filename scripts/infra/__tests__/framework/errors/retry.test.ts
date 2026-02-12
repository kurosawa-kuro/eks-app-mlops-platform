/**
 * Tests for withRetry function
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../framework/errors/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { initialDelayMs: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('calls onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 1,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1);
  });

  it('respects isRetryable function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('not retryable'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        isRetryable: () => false,
      })
    ).rejects.toThrow('not retryable');

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('uses exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 1,
      backoffFactor: 2,
      onRetry,
    });

    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 2);
  });
});
