import type { ITokenBlacklistWithCleanup } from './ITokenBlacklist.js'

/**
 * In-memory token blacklist for development and testing
 *
 * Features:
 * - Map-based storage with automatic expiration checking
 * - Periodic cleanup of expired tokens (every 5 minutes)
 * - Graceful cleanup via destroy() method
 *
 * Note: Not suitable for distributed deployments.
 * Use RedisTokenBlacklist for multi-instance environments.
 */
export class InMemoryTokenBlacklist implements ITokenBlacklistWithCleanup {
  private blacklist = new Map<string, Date>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Start periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    // Allow process to exit even if timer is running
    this.cleanupInterval.unref()
  }

  async add(token: string, expiresAt: Date): Promise<void> {
    this.blacklist.set(token, expiresAt)
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const expiresAt = this.blacklist.get(token)
    if (!expiresAt) {
      return false
    }

    // If expired, remove from blacklist
    if (expiresAt < new Date()) {
      this.blacklist.delete(token)
      return false
    }

    return true
  }

  /**
   * Remove expired tokens from the blacklist
   */
  private cleanup(): void {
    const now = new Date()
    for (const [token, expiresAt] of this.blacklist.entries()) {
      if (expiresAt < now) {
        this.blacklist.delete(token)
      }
    }
  }

  /**
   * Stop the cleanup interval and clear resources
   * Call this during graceful shutdown or in tests
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.blacklist.clear()
  }

  /**
   * Get the current size of the blacklist (for testing/monitoring)
   */
  size(): number {
    return this.blacklist.size
  }
}
