import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose'
import type { Logger } from 'pino'
import { BaseLogService } from '../BaseLogService.js'
import type { EnvConfig, IAccessLogService } from '../../../container/types.js'
import type { FirehoseLogRecord, FirehoseSendResult } from '../../../domain/types/firehose.js'

/**
 * AWS Firehose service for production request logging
 * Sends access logs to Firehose for S3 archival
 */
export class FirehoseService
  extends BaseLogService<FirehoseLogRecord, FirehoseSendResult>
  implements IAccessLogService
{
  private client: FirehoseClient
  private streamName: string

  constructor(env: EnvConfig, logger: Logger) {
    super(logger)

    this.enabled = env.LOG_MODE === 'firehose' && !!env.FIREHOSE_STREAM_NAME
    this.streamName = env.FIREHOSE_STREAM_NAME || ''

    this.client = new FirehoseClient({
      region: env.AWS_REGION,
    })

    if (this.enabled) {
      this.logger.info(
        { streamName: this.streamName, region: env.AWS_REGION },
        'Firehose service initialized'
      )
    }
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
    if (!this.enabled) {
      return { success: false, errorCode: 'DISABLED', errorMessage: 'Firehose is not enabled' }
    }

    try {
      const enriched = this.enrich(record)
      const data = JSON.stringify(enriched) + '\n'

      const command = new PutRecordCommand({
        DeliveryStreamName: this.streamName,
        Record: {
          Data: Buffer.from(data, 'utf-8'),
        },
      })

      const response = await this.client.send(command)

      return {
        success: true,
        recordId: response.RecordId,
      }
    } catch (error) {
      const err = error as Error
      this.logger.error({ err, record }, 'Firehose send failed')

      return {
        success: false,
        errorCode: err.name,
        errorMessage: err.message,
      }
    }
  }
}
