import type { MiddlewareHandler } from 'hono'
import { resolve } from '../../container/index.js'
import type { IAccessLogService } from '../../container/types.js'
import type { FirehoseLogRecord } from '../../domain/types/firehose.js'
import type { AuthPayload } from '../../domain/types/auth.js'

/**
 * Access Log Middleware Factory with explicit dependency injection
 *
 * Creates a middleware that logs all HTTP requests to the configured service.
 * This pattern enables unit testing with mock log service.
 *
 * @param logService - Access log service instance
 * @returns MiddlewareHandler
 */
export function createAccessLogMiddleware(
  logService: IAccessLogService,
): MiddlewareHandler {
  return async (c, next) => {
    // Skip if log service is not enabled
    if (!logService.isEnabled()) {
      await next()
      return
    }

    const startTime = Date.now()

    // Capture request details before processing
    const method = c.req.method
    const path = c.req.path
    const userAgent = c.req.header('user-agent')

    // Get client IP (works with proxies if x-forwarded-for is set)
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'

    // Get request ID from context (set by requestIdMiddleware)
    const requestId = c.get('requestId')

    await next()

    // Calculate duration after response is ready
    const durationMs = Date.now() - startTime
    const statusCode = c.res.status

    // Get user info from context (set by auth middleware, if authenticated)
    const user = c.get('user') as AuthPayload | undefined

    // Build audit log record
    const logRecord: FirehoseLogRecord = {
      timestamp: new Date().toISOString(),
      method,
      path,
      statusCode,
      durationMs,
      userAgent,
      ip,
      requestId,
      // User identification (Audit)
      userId: user?.sub,
      userEmail: user?.email,
      userRole: user?.role,
    }

    // Fire-and-forget - send to log service without waiting
    logService.sendLog(logRecord)
  }
}

/**
 * Access Log Middleware (backward compatible)
 *
 * Logs all HTTP requests with user identification to the configured log service:
 * - LOG_MODE=console → ConsoleLogService (human-readable Pino output)
 * - LOG_MODE=firehose → FirehoseService (S3 archival via Kinesis Firehose)
 *
 * Uses fire-and-forget pattern to ensure logging never blocks responses.
 *
 * Note: This middleware depends on requestIdMiddleware running first.
 * Place AFTER auth middleware to capture user info.
 */
export const accessLogMiddleware: MiddlewareHandler = async (c, next) => {
  const logService = resolve('accessLogService')
  const middleware = createAccessLogMiddleware(logService)
  return middleware(c, next)
}
