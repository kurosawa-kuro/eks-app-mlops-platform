import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import type { Logger } from 'pino'
import { BaseLogService } from '../BaseLogService.js'
import type { EnvConfig, IErrorLogService, ErrorLogDetail } from '../../../container/types.js'

/**
 * Internal record type with message included
 */
type ErrorRecord = ErrorLogDetail & { message: string }

/**
 * CloudWatch error log service for production error monitoring
 * Sends only unhandled errors (500) to CloudWatch Logs
 */
export class CloudWatchErrorLogService
  extends BaseLogService<ErrorRecord, void>
  implements IErrorLogService
{
  private client: CloudWatchLogsClient
  private logGroupName: string
  private logStreamName: string

  constructor(env: EnvConfig, logger: Logger) {
    super(logger)

    this.enabled = !!env.ERROR_LOG_GROUP
    this.logGroupName = env.ERROR_LOG_GROUP || ''
    this.logStreamName = `errors-${new Date().toISOString().slice(0, 10)}`

    this.client = new CloudWatchLogsClient({ region: env.AWS_REGION })

    if (this.enabled) {
      this.initialize()
      this.logger.info(
        { logGroup: this.logGroupName, logStream: this.logStreamName },
        'CloudWatch error log service initialized'
      )
    }
  }

  private async initialize(): Promise<void> {
    try {
      await this.client.send(
        new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        })
      )
    } catch (err: unknown) {
      const error = err as Error & { name: string }
      if (error.name !== 'ResourceAlreadyExistsException') {
        this.logger.error({ err }, 'Failed to create CloudWatch log stream')
      }
    }
  }

  /**
   * Fire-and-forget error logging (IErrorLogService interface)
   */
  logError(message: string, detail: ErrorLogDetail): void {
    if (!this.enabled) return
    this.sendAsync({ message, ...detail })
  }

  /**
   * Async error logging (IErrorLogService interface)
   */
  async logErrorAsync(message: string, detail: ErrorLogDetail): Promise<void> {
    if (!this.enabled) return
    await this.send({ message, ...detail })
  }

  /**
   * Internal send implementation
   */
  protected async send(record: ErrorRecord): Promise<void> {
    if (!this.enabled) return

    try {
      const enriched = this.enrich(record)

      await this.client.send(
        new PutLogEventsCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          logEvents: [
            {
              timestamp: Date.now(),
              message: JSON.stringify(enriched),
            },
          ],
        })
      )
    } catch (err) {
      this.logger.error({ err, record }, 'CloudWatch PutLogEvents failed')
    }
  }
}
