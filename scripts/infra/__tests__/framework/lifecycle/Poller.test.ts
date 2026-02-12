/**
 * Tests for Poller class
 */
import { describe, it, expect, vi } from 'vitest';
import { Poller } from '../../../framework/lifecycle/Poller.js';
import { createMockPollerDependencies } from '../../utils/test-helpers.js';

describe('Poller', () => {
  it('returns SUCCESS on first check', async () => {
    const deps = createMockPollerDependencies();
    const poller = new Poller(60, 5, deps);
    const checkFn = vi.fn().mockResolvedValue({ done: true, success: true });

    const result = await poller.poll(checkFn);

    expect(result.success).toBe(true);
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect(deps.sleep).not.toHaveBeenCalled(); // Success on first try
  });

  it('returns SUCCESS after retries', async () => {
    const deps = createMockPollerDependencies();
    const poller = new Poller(60, 1, deps);
    const checkFn = vi.fn()
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValue({ done: true, success: true });

    const result = await poller.poll(checkFn);

    expect(result.success).toBe(true);
    expect(checkFn).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenCalledTimes(2); // Slept between retries
  });

  it('calls onTick callback', async () => {
    const deps = createMockPollerDependencies();
    const poller = new Poller(60, 1, deps);
    const checkFn = vi.fn().mockResolvedValue({ done: true, success: true });
    const onTick = vi.fn();

    await poller.poll(checkFn, { onTick });

    expect(onTick).toHaveBeenCalled();
  });

  it('calls onSuccess callback', async () => {
    const deps = createMockPollerDependencies();
    const poller = new Poller(60, 1, deps);
    const checkFn = vi.fn().mockResolvedValue({ done: true, success: true, data: 'test' });
    const onSuccess = vi.fn();

    await poller.poll(checkFn, { onSuccess });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
