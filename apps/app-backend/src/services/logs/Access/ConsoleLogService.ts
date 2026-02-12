import type { Logger } from 'pino'
import { BaseLogService } from '../BaseLogService.js'
import type { IAccessLogService } from '../../../container/types.js'
import type { FirehoseLogRecord, FirehoseSendResult } from '../../../domain/types/firehose.js'

/**
 * Console log service for local development
 * Outputs human-readable access logs via Pino
 */
export class ConsoleLogService
  extends BaseLogService<FirehoseLogRecord, FirehoseSendResult>
  implements IAccessLogService
{
  constructor(logger: Logger) {
    super(logger)
    this.enabled = true
  }

  /**
   * Fire-and-forget log sending (IAccessLogService interface)
   */
  sendLog(record: FirehoseLogRecord): void {
    this.sendAsync(record)
  }

  /**
   * Async log sending with result (IAccessLogService interface)
   */
  async sendLogAsync(record: FirehoseLogRecord): Promise<FirehoseSendResult> {
    return this.send(record)
  }

  /**
   * Internal send implementation
   */
  protected async send(record: FirehoseLogRecord): Promise<FirehoseSendResult> {
    const enriched = this.enrich(record)

    this.logger.info(
      { type: 'access_log', ...enriched },
      `${enriched.method} ${enriched.path} ${enriched.statusCode} ${enriched.durationMs}ms`
    )

    return {
      success: true,
      recordId: `console-${Date.now()}`,
    }
  }
}
