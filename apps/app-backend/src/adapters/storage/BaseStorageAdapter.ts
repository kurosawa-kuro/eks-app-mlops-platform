import type { Logger } from 'pino'
import type { IS3Adapter } from '../../container/types.js'
import type { AnalyticsResult } from '../../domain/types/analytics.js'

/**
 * Base storage adapter providing common error handling utilities
 *
 * DRY: Error handling and logging patterns shared across storage adapters
 *
 * Implementations:
 * - S3Adapter: AWS S3 (production)
 * - MockS3Adapter: In-memory mock data (development/testing)
 * - Future: GCSAdapter, MinIOAdapter, etc.
 */
export abstract class BaseStorageAdapter implements IS3Adapter {
  constructor(protected readonly logger: Logger) {}

  /**
   * Get object from storage
   * Must be implemented by concrete adapters
   */
  abstract getObject<T>(bucket: string, key: string): Promise<AnalyticsResult<T>>

  /**
   * Create a not-found error result
   */
  protected notFoundResult<T>(bucket: string, key: string): AnalyticsResult<T> {
    this.logger.warn({ bucket, key }, 'Storage object not found')
    return { success: false, error: 'File not found' }
  }

  /**
   * Create an error result from an exception
   */
  protected errorResult<T>(
    error: Error,
    bucket: string,
    key: string,
    context?: string,
  ): AnalyticsResult<T> {
    this.logger.error({ err: error, bucket, key }, context ?? 'Storage operation failed')
    return { success: false, error: error.message }
  }

  /**
   * Create a success result
   */
  protected successResult<T>(data: T, cachedAt?: string): AnalyticsResult<T> {
    return {
      success: true,
      data,
      cachedAt: cachedAt ?? new Date().toISOString(),
    }
  }
}
