import type { Logger } from 'pino'

/**
 * Base class for all log services (Console, Firehose, CloudWatch)
 *
 * Provides:
 *  - enabled flag management
 *  - timestamp / requestId enrichment
 *  - fire-and-forget wrapper (non-blocking)
 *  - error logging to Pino
 *
 * @template RecordType - Input record type (FirehoseLogRecord or ErrorLogDetail)
 * @template ResultType - Return type from send operation
 */
export abstract class BaseLogService<RecordType, ResultType> {
  protected enabled = true

  constructor(protected logger: Logger) {}

  /**
   * Abstract method - must be implemented by subclasses
   * Performs the actual log sending operation
   */
  protected abstract send(record: RecordType): Promise<ResultType>

  /**
   * Fire-and-forget API for middleware use
   * Ensures logging never blocks request handling
   */
  protected sendAsync(record: RecordType): void {
    if (!this.enabled) return

    setImmediate(() => {
      this.send(record).catch(err => {
        this.logger.error({ err, record }, 'Log sending failed')
      })
    })
  }

  /**
   * Enriches record with timestamp and requestId if missing
   * Ensures consistent log structure across all backends
   */
  protected enrich(
    record: RecordType
  ): RecordType & { timestamp: string; requestId: string } {
    const timestamp = new Date().toISOString()
    const rec = record as unknown as { requestId?: string }
    const requestId =
      rec.requestId ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    return {
      ...(record as object),
      timestamp,
      requestId,
    } as RecordType & { timestamp: string; requestId: string }
  }

  /**
   * Check if the service is enabled
   * Used by DI containers and runtime checks
   */
  isEnabled(): boolean {
    return this.enabled
  }
}
