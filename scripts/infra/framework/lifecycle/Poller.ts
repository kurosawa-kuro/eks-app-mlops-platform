/**
 * Poller - polls for condition with timeout.
 *
 * @example
 * // Production usage
 * const poller = new Poller(60, 5);
 * const result = await poller.poll(checkFn);
 *
 * @example
 * // Testing with mock dependencies
 * const deps = { sleep: vi.fn().mockResolvedValue(undefined) };
 * const poller = new Poller(60, 5, deps);
 */

import { sleep as defaultSleep } from '../../infrastructure/shell/index.js';
import type { PollerResult, PollerOptions, PollResult } from '../types.js';

/** Dependencies for Poller, enables testing without real delays */
export interface PollerDependencies {
  sleep: (seconds: number) => Promise<void>;
}

const defaultDependencies: PollerDependencies = {
  sleep: defaultSleep,
};

export class Poller {
  timeout: number;
  interval: number;
  elapsed: number;
  private deps: PollerDependencies;

  constructor(timeout: number, interval: number, deps: Partial<PollerDependencies> = {}) {
    this.timeout = timeout;
    this.interval = interval;
    this.elapsed = 0;
    this.deps = { ...defaultDependencies, ...deps };
  }

  async poll<T extends PollerResult>(checkFn: (elapsed: number) => Promise<T>, options: PollerOptions<T> = {}): Promise<PollResult<T> & Partial<T>> {
    const { onTick, onSuccess, onFailure } = options;
    while (this.elapsed < this.timeout) {
      const result = await checkFn(this.elapsed);
      if (onTick) onTick(this.elapsed, this.interval, result);
      if (result.done) {
        if (result.success) {
          if (onSuccess) onSuccess(result);
          return { success: true, ...result };
        } else {
          if (onFailure) onFailure(result);
          return { success: false, ...result };
        }
      }
      await this.deps.sleep(this.interval * 1000);
      this.elapsed += this.interval;
    }
    return { success: false, reason: 'TIMEOUT', elapsed: this.elapsed } as PollResult<T> & Partial<T>;
  }
}
