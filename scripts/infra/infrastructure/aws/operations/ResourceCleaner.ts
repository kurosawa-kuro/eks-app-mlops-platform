/**
 * ResourceCleaner - Generic AWS Resource Cleanup Engine
 *
 * Provides a reusable pattern for cleaning up AWS resources with:
 * - Resource listing
 * - Pre-delete hooks
 * - Deletion with wait for completion
 * - Dry-run support
 * - Adaptive waiting with exponential backoff
 */

import { log } from '../../../framework/logging/index.js';
import { toError } from '../../types.js';
import { sleep } from '../../shell/index.js';
import { c } from '../../../framework/logging/colors.js';

/**
 * Configuration for adaptive waiting with exponential backoff.
 */
export interface AdaptiveWaitConfig {
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier: number;
}

/**
 * AdaptiveWaiter - Implements exponential backoff for resource polling.
 *
 * Starts with a short delay and increases it exponentially up to a maximum,
 * reducing unnecessary API calls while still detecting early completions.
 */
export class AdaptiveWaiter {
  private config: AdaptiveWaitConfig;

  constructor(config: Partial<AdaptiveWaitConfig> = {}) {
    this.config = {
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 10000,
      backoffMultiplier: config.backoffMultiplier ?? 1.5,
    };
  }

  /**
   * Wait until condition is met or timeout is reached.
   * @param checkFn Function that returns true when the condition is met
   * @param timeoutMs Maximum time to wait in milliseconds
   * @param onWait Optional callback called on each wait iteration
   * @returns true if condition was met, false if timeout
   */
  async waitUntil(
    checkFn: () => Promise<boolean>,
    timeoutMs: number,
    onWait?: (elapsedMs: number, currentDelayMs: number) => void
  ): Promise<boolean> {
    const startTime = Date.now();
    let currentDelay = this.config.initialDelayMs;

    while (Date.now() - startTime < timeoutMs) {
      if (await checkFn()) {
        return true;
      }

      const elapsed = Date.now() - startTime;
      if (onWait) {
        onWait(elapsed, currentDelay);
      }

      await sleep(currentDelay);

      // Exponential backoff up to maxDelay
      currentDelay = Math.min(
        currentDelay * this.config.backoffMultiplier,
        this.config.maxDelayMs
      );
    }

    return false;
  }

  /**
   * Wait for all items to satisfy a condition.
   * @param items Items to wait for
   * @param checkFn Function that returns true when an item's condition is met
   * @param getId Function to get item ID for logging
   * @param timeoutMs Maximum time to wait in milliseconds
   * @param onProgress Optional callback for progress updates
   */
  async waitForAll<T>(
    items: T[],
    checkFn: (item: T) => Promise<boolean>,
    getId: (item: T) => string,
    timeoutMs: number,
    onProgress?: (item: T, elapsed: number) => void
  ): Promise<{ completed: T[]; timedOut: T[] }> {
    const completed: T[] = [];
    const timedOut: T[] = [];
    const startTime = Date.now();

    for (const item of items) {
      const id = getId(item);
      const remainingTime = timeoutMs - (Date.now() - startTime);

      if (remainingTime <= 0) {
        timedOut.push(item);
        continue;
      }

      const success = await this.waitUntil(
        () => checkFn(item),
        remainingTime,
        (elapsed) => {
          if (onProgress) onProgress(item, elapsed);
          process.stdout.write(`\r  ${c.cyan('waiting')} Waiting for ${id}...`);
        }
      );

      if (success) {
        completed.push(item);
      } else {
        timedOut.push(item);
      }
    }

    if (items.length > 0) {
      console.log('');
    }

    return { completed, timedOut };
  }
}

/**
 * Options for the ResourceCleaner.
 */
export interface ResourceCleanerOptions<T> {
  /** Resource type name for logging */
  name: string;
  /** Function to list resources */
  list: () => Promise<T[]>;
  /** Function to delete a single resource */
  delete: (resource: T) => Promise<void>;
  /** Optional pre-delete hook (e.g., remove dependencies) */
  preDelete?: (resource: T) => Promise<void>;
  /** Optional function to check if resource is deleted */
  checkDeleted?: (resource: T) => Promise<boolean>;
  /** Function to get resource ID for logging */
  getId?: (resource: T) => string;
  /** Optional wait time after all deletions */
  waitAfterAll?: number;
}

/**
 * Configuration for the cleaner execution.
 */
export interface CleanerConfig {
  /** Dry-run mode - don't actually delete */
  dryRun: boolean;
  /** Timeout for deletion wait in seconds */
  deleteTimeout: number;
  /** Poll interval in seconds (deprecated: use adaptiveWait for better performance) */
  pollInterval: number;
  /** Optional adaptive wait configuration (overrides pollInterval when set) */
  adaptiveWait?: Partial<AdaptiveWaitConfig>;
}

/**
 * Result of a cleanup operation.
 */
export interface CleanerResult {
  /** Number of resources found */
  found: number;
  /** Number of resources deleted (or would be deleted in dry-run) */
  deleted: number;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error messages, if any */
  errors: string[];
}

/**
 * Generic resource cleaner that handles AWS resource deletion.
 */
export class ResourceCleaner<T> {
  private opts: ResourceCleanerOptions<T>;
  private config: CleanerConfig;
  private waiter: AdaptiveWaiter;

  constructor(opts: ResourceCleanerOptions<T>, config: CleanerConfig) {
    this.opts = opts;
    this.config = config;
    // Use adaptive wait config if provided, otherwise create default from pollInterval
    this.waiter = new AdaptiveWaiter(
      config.adaptiveWait ?? {
        initialDelayMs: Math.min(config.pollInterval * 1000, 2000),
        maxDelayMs: config.pollInterval * 1000 * 2,
        backoffMultiplier: 1.5,
      }
    );
  }

  /**
   * Run the cleanup operation.
   */
  async run(): Promise<CleanerResult> {
    const { name, list, delete: del, preDelete, checkDeleted, getId = (r) => String(r), waitAfterAll } = this.opts;
    const { dryRun, deleteTimeout } = this.config;
    const errors: string[] = [];

    const resources = await list();
    if (resources.length === 0) {
      log.info(`No ${name} found`);
      return { found: 0, deleted: 0, success: true, errors: [] };
    }

    log.info(`Found ${resources.length} ${name}(s)`);

    // Pre-delete hooks
    if (preDelete) {
      for (const r of resources) {
        try {
          await preDelete(r);
        } catch (e: unknown) {
          const msg = `Pre-delete failed for ${name} ${getId(r)}: ${toError(e).message}`;
          log.warn(msg);
          errors.push(msg);
        }
      }
    }

    // Delete resources
    const pending: T[] = [];
    let deleted = 0;

    for (const r of resources) {
      const id = getId(r);
      if (dryRun) {
        log.dryRun(`Would delete ${name}: ${id}`);
        deleted++;
      } else {
        try {
          await del(r);
          log.pass(`${name} deletion initiated: ${id}`);
          deleted++;
          if (checkDeleted) pending.push(r);
        } catch (e: unknown) {
          const msg = `Failed to delete ${name} ${id}: ${toError(e).message}`;
          log.warn(msg);
          errors.push(msg);
        }
      }
    }

    // Wait for deletions to complete using adaptive waiting
    if (!dryRun && checkDeleted && pending.length > 0) {
      log.info(`Waiting for ${name} deletions (adaptive polling)...`);
      const waitResult = await this.waiter.waitForAll(
        pending,
        checkDeleted,
        getId,
        deleteTimeout * 1000
      );
      for (const item of waitResult.completed) {
        log.pass(`${name} deleted: ${getId(item)}`);
      }
      for (const item of waitResult.timedOut) {
        const msg = `${name} deletion timed out: ${getId(item)}`;
        log.warn(msg);
        errors.push(msg);
      }
    }

    // Wait after all deletions
    if (!dryRun && waitAfterAll) {
      await sleep(waitAfterAll);
    }

    return {
      found: resources.length,
      deleted,
      success: errors.length === 0,
      errors,
    };
  }

}

/**
 * Factory function to create a ResourceCleaner with default config.
 */
export function createResourceCleaner<T>(
  opts: ResourceCleanerOptions<T>,
  config: Partial<CleanerConfig> = {}
): ResourceCleaner<T> {
  const defaultConfig: CleanerConfig = {
    dryRun: false,
    deleteTimeout: 300,
    pollInterval: 5, // deprecated, kept for backward compatibility
    adaptiveWait: {
      initialDelayMs: 1000,  // Start with 1 second
      maxDelayMs: 10000,     // Max 10 seconds between polls
      backoffMultiplier: 1.5,
    },
  };
  return new ResourceCleaner(opts, { ...defaultConfig, ...config });
}
