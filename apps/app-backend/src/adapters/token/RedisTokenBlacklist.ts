import { Redis } from 'ioredis'
import type { EnvConfig } from '../../container/types.js'
import type { ITokenBlacklistWithCleanup } from './ITokenBlacklist.js'

/**
 * Redis-based token blacklist for production environments
 *
 * Features:
 * - Uses Redis SETEX for automatic expiration (no manual cleanup needed)
 * - Lazy connection initialization
 * - Graceful disconnect via destroy() method
 *
 * Suitable for distributed deployments (EKS, Lambda).
 */
export class RedisTokenBlacklist implements ITokenBlacklistWithCleanup {
  private redis: Redis | null = null
  private readonly prefix = 'token_blacklist:'

  constructor(private readonly env: EnvConfig) {}

  private getClient(): Redis {
    if (!this.redis) {
      if (!this.env.REDIS_URL) {
        throw new Error('REDIS_URL is required for Redis token blacklist')
      }
      this.redis = new Redis(this.env.REDIS_URL)
    }
    return this.redis
  }

  async add(token: string, expiresAt: Date): Promise<void> {
    const client = this.getClient()
    const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

    if (ttlSeconds > 0) {
      await client.setex(`${this.prefix}${token}`, ttlSeconds, '1')
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const client = this.getClient()
    const result = await client.exists(`${this.prefix}${token}`)
    return result === 1
  }

  /**
   * Close the Redis connection
   * Call this during graceful shutdown
   */
  async destroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
    }
  }
}
