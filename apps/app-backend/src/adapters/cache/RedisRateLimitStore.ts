import { Redis } from 'ioredis'
import type { IRateLimitStore, RateLimitEntry } from './IRateLimitStore.js'
import type { EnvConfig } from '../../container/types.js'

/**
 * Redis-based rate limit store for distributed environments
 *
 * Uses Redis for storing rate limit data, enabling consistent rate limiting
 * across multiple instances (EKS, Lambda, etc.)
 *
 * Note: This implementation uses a cache layer to provide synchronous access
 * while periodically syncing with Redis. For strict distributed rate limiting,
 * consider using Redis Lua scripts for atomic operations.
 */
export class RedisRateLimitStore implements IRateLimitStore {
  private redis: Redis | null = null
  private localCache = new Map<string, RateLimitEntry>()
  private readonly prefix = 'rate_limit:'
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(private readonly env: EnvConfig) {
    // Initialize Redis connection lazily
    this.initRedis()
  }

  private initRedis(): void {
    if (!this.env.REDIS_URL) {
      console.warn('REDIS_URL not configured, falling back to local cache only')
      return
    }

    try {
      this.redis = new Redis(this.env.REDIS_URL)

      // Start periodic sync with Redis
      this.syncInterval = setInterval(() => this.syncToRedis(), 5000)
    } catch (error) {
      console.error('Failed to initialize Redis connection:', error)
    }
  }

  get(key: string): RateLimitEntry | undefined {
    return this.localCache.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.localCache.set(key, entry)
    // Fire-and-forget Redis update
    this.setRedisAsync(key, entry).catch(() => {
      // Ignore Redis errors, local cache is authoritative for this instance
    })
  }

  delete(key: string): void {
    this.localCache.delete(key)
    if (this.redis) {
      this.redis.del(`${this.prefix}${key}`).catch(() => {})
    }
  }

  cleanup(now: number): void {
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.resetTime < now) {
        this.localCache.delete(key)
      }
    }
  }

  startCleanup(intervalMs: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanup(Date.now())
    }, intervalMs)
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  clear(): void {
    this.localCache.clear()
    // Note: Does not clear Redis to avoid affecting other instances
  }

  private async setRedisAsync(key: string, entry: RateLimitEntry): Promise<void> {
    if (!this.redis) return

    const ttlSeconds = Math.max(1, Math.ceil((entry.resetTime - Date.now()) / 1000))
    await this.redis.setex(
      `${this.prefix}${key}`,
      ttlSeconds,
      JSON.stringify(entry),
    )
  }

  private async syncToRedis(): Promise<void> {
    if (!this.redis) return

    const pipeline = this.redis.pipeline()
    const now = Date.now()

    for (const [key, entry] of this.localCache.entries()) {
      if (entry.resetTime > now) {
        const ttlSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000))
        pipeline.setex(`${this.prefix}${key}`, ttlSeconds, JSON.stringify(entry))
      }
    }

    await pipeline.exec()
  }

  /**
   * Close the Redis connection (for cleanup)
   */
  async disconnect(): Promise<void> {
    this.stopCleanup()
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
    }
  }
}
