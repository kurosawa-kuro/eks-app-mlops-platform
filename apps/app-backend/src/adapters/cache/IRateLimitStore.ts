/**
 * Rate limit entry stored per client key
 */
export interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * Rate limit store interface
 *
 * Abstracts the storage mechanism for rate limiting data.
 * Allows swapping implementations:
 * - InMemoryRateLimitStore: Single-instance deployments
 * - RedisRateLimitStore: Distributed deployments (EKS, Lambda)
 *
 * DI対応: コンテナ経由で実装を切り替え可能
 */
export interface IRateLimitStore {
  /**
   * Get rate limit entry for a key
   */
  get(key: string): RateLimitEntry | undefined

  /**
   * Set rate limit entry for a key
   */
  set(key: string, entry: RateLimitEntry): void

  /**
   * Delete rate limit entry for a key
   */
  delete(key: string): void

  /**
   * Cleanup expired entries
   * @param now - Current timestamp in milliseconds
   */
  cleanup(now: number): void

  /**
   * Start periodic cleanup (optional, for stores that need it)
   * @param intervalMs - Cleanup interval in milliseconds
   */
  startCleanup?(intervalMs: number): void

  /**
   * Stop periodic cleanup (for graceful shutdown)
   */
  stopCleanup?(): void

  /**
   * Clear all entries (for testing)
   */
  clear?(): void
}
