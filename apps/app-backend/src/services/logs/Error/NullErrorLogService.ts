import type { IErrorLogService, ErrorLogDetail } from '../../../container/types.js'

/**
 * Null error log service - does nothing
 * Used when ERROR_LOG_GROUP is not configured
 */
export class NullErrorLogService implements IErrorLogService {
  logError(_message: string, _detail: ErrorLogDetail): void {
    // Do nothing
  }

  async logErrorAsync(_message: string, _detail: ErrorLogDetail): Promise<void> {
    // Do nothing
  }

  isEnabled(): boolean {
    return false
  }
}
