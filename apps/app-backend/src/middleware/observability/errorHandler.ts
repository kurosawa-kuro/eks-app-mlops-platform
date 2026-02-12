import type { ErrorHandler } from 'hono'
import type { Logger } from 'pino'
import { HTTPException } from 'hono/http-exception'
import { resolve } from '../../container/index.js'
import type { IErrorLogService } from '../../container/types.js'

/**
 * Unified error response format
 */
interface ErrorResponse {
  error: {
    message: string
    status: number
    code?: string
    requestId?: string
  }
}

/**
 * Error Handler Factory
 *
 * Creates a global error handler with explicit dependencies.
 * This pattern enables:
 * - Unit testing with mock logger and errorLogService
 * - Clear dependency graph
 * - No hidden resolve() calls
 *
 * @param logger - Pino logger instance for console output
 * @param errorLogService - Error log service (CloudWatch or Null)
 * @returns ErrorHandler middleware function
 */
export function createErrorHandler(
  logger: Logger,
  errorLogService: IErrorLogService,
): ErrorHandler {
  return (err, c) => {
    const requestId = c.get('requestId') || c.req.header('x-request-id')

    // HTTPException（意図的なエラー）
    if (err instanceof HTTPException) {
      return c.json<ErrorResponse>({
        error: {
          message: err.message,
          status: err.status,
          requestId,
        }
      }, err.status)
    }

    // 予期しないエラー → CloudWatch に送信
    errorLogService.logError('Unhandled Error', {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
      statusCode: 500,
      requestId,
    })

    // Pino にもログ出力（開発時のデバッグ用）
    logger.error({
      err,
      path: c.req.path,
      method: c.req.method,
      requestId,
    }, 'Unhandled error')

    const isDev = process.env.NODE_ENV !== 'production'

    return c.json<ErrorResponse>({
      error: {
        message: isDev ? err.message : 'Internal Server Error',
        status: 500,
        requestId,
      }
    }, 500)
  }
}

/**
 * Global Error Handler (backward compatible export)
 *
 * Uses DI container to resolve dependencies.
 * For new code, prefer createErrorHandler() with explicit injection.
 */
export const errorHandler: ErrorHandler = createErrorHandler(
  resolve('logger'),
  resolve('errorLogService'),
)
