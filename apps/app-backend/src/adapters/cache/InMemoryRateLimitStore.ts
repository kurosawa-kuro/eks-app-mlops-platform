import type { IRateLimitStore, RateLimitEntry } from './IRateLimitStore.js'

/**
 * In-memory rate limit store
 *
 * Suitable for single-instance deployments.
 * For distributed environments (EKS, Lambda), use RedisRateLimitStore.
 *
 * Features:
 * - Fast Map-based storage
 * - Automatic cleanup of expired entries
 * - Graceful shutdown support
 */
export class InMemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  cleanup(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key)
      }
    }
  }

  startCleanup(intervalMs: number): void {
    if (this.cleanupTimer) {
      return // Already running
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup(Date.now())
    }, intervalMs)
    // Allow process to exit even if timer is running
    this.cleanupTimer.unref()
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  clear(): void {
    this.store.clear()
  }
}
