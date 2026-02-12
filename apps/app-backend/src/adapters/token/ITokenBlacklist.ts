/**
 * Token blacklist interface for invalidating JWT tokens
 *
 * Used to track revoked/logged-out tokens until they expire.
 * Implementations:
 * - InMemoryTokenBlacklist: Development/single-instance
 * - RedisTokenBlacklist: Production/distributed deployments
 */
export interface ITokenBlacklist {
  /**
   * Add a token to the blacklist
   * @param token - JWT token string
   * @param expiresAt - When the token naturally expires (for cleanup)
   */
  add(token: string, expiresAt: Date): Promise<void>

  /**
   * Check if a token is blacklisted
   * @param token - JWT token string
   * @returns true if blacklisted, false otherwise
   */
  isBlacklisted(token: string): Promise<boolean>
}

/**
 * Extended interface for token blacklist implementations that support cleanup
 */
export interface ITokenBlacklistWithCleanup extends ITokenBlacklist {
  /**
   * Destroy/cleanup resources (timers, connections)
   */
  destroy(): void | Promise<void>
}
