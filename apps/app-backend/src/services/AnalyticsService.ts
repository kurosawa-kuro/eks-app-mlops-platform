import type { Logger } from 'pino'
import type { EnvConfig, IS3Adapter, IAnalyticsService } from '../container/types.js'
import type { AnalyticsData, AnalyticsResult, SentimentData } from '../domain/types/analytics.js'

/**
 * Cache entry for analytics data
 */
interface CacheEntry<T> {
  data: T
  expiry: number
  cachedAt: string
}

/**
 * Analytics service for reading pre-computed analytics from S3
 *
 * Features:
 * - In-memory caching with configurable TTL (default: 60 seconds)
 * - Reduces S3 API calls and improves response times
 * - Cache is invalidated automatically after TTL expires
 *
 * Note: Cache is per-instance. For distributed deployments,
 * consider Redis-based caching for shared state.
 */
export class AnalyticsService implements IAnalyticsService {
  private bucket: string
  private enabled: boolean
  private analyticsCache: CacheEntry<AnalyticsData> | null = null
  private sentimentCache: CacheEntry<SentimentData> | null = null

  /** Cache TTL in milliseconds (60 seconds) */
  private readonly cacheTtlMs = 60_000

  constructor(
    env: EnvConfig,
    private s3Adapter: IS3Adapter,
    private logger: Logger,
  ) {
    this.bucket = env.ANALYTICS_S3_BUCKET || ''
    this.enabled = env.ENABLE_ANALYTICS_API && !!env.ANALYTICS_S3_BUCKET

    if (this.enabled) {
      this.logger.info(
        { bucket: this.bucket, cacheTtlMs: this.cacheTtlMs },
        'Analytics service initialized with caching',
      )
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async getAnalytics(): Promise<AnalyticsResult<AnalyticsData>> {
    if (!this.enabled) {
      return { success: false, error: 'Analytics API is not enabled' }
    }

    const now = Date.now()

    // Return cached data if still valid
    if (this.analyticsCache && this.analyticsCache.expiry > now) {
      this.logger.debug({ cachedAt: this.analyticsCache.cachedAt }, 'Analytics cache hit')
      return {
        success: true,
        data: this.analyticsCache.data,
        cachedAt: this.analyticsCache.cachedAt,
      }
    }

    // Fetch from S3
    this.logger.debug('Analytics cache miss, fetching from S3')
    const result = await this.s3Adapter.getObject<AnalyticsData>(
      this.bucket,
      'analytics/analytics_latest.json',
    )

    // Update cache on successful fetch
    if (result.success && result.data) {
      const cachedAt = new Date().toISOString()
      this.analyticsCache = {
        data: result.data,
        expiry: now + this.cacheTtlMs,
        cachedAt,
      }
      return {
        success: true,
        data: result.data,
        cachedAt,
      }
    }

    return result
  }

  async getSentiment(): Promise<AnalyticsResult<SentimentData>> {
    if (!this.enabled) {
      return { success: false, error: 'Analytics API is not enabled' }
    }

    const now = Date.now()

    // Return cached data if still valid
    if (this.sentimentCache && this.sentimentCache.expiry > now) {
      this.logger.debug({ cachedAt: this.sentimentCache.cachedAt }, 'Sentiment cache hit')
      return {
        success: true,
        data: this.sentimentCache.data,
        cachedAt: this.sentimentCache.cachedAt,
      }
    }

    // Fetch from S3
    this.logger.debug('Sentiment cache miss, fetching from S3')
    const result = await this.s3Adapter.getObject<SentimentData>(
      this.bucket,
      'analytics/sentiment_results.json',
    )

    // Update cache on successful fetch
    if (result.success && result.data) {
      const cachedAt = new Date().toISOString()
      this.sentimentCache = {
        data: result.data,
        expiry: now + this.cacheTtlMs,
        cachedAt,
      }
      return {
        success: true,
        data: result.data,
        cachedAt,
      }
    }

    return result
  }

  /**
   * Invalidate the cache (for testing or manual refresh)
   */
  invalidateCache(): void {
    this.analyticsCache = null
    this.sentimentCache = null
    this.logger.debug('Analytics caches invalidated')
  }
}
