import type { MiddlewareHandler } from 'hono'

/**
 * Generate a unique request ID
 * Format: req-{timestamp}-{random}
 */
const generateRequestId = (): string => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Request ID Middleware
 *
 * Assigns a unique request ID to each request for distributed tracing.
 * - Uses X-Request-ID header if provided (for cross-service tracing)
 * - Generates a new ID if not provided
 * - Stores in context for use by other middleware (accessLog, errorHandler)
 * - Sets X-Request-ID response header for client debugging
 *
 * This middleware should run FIRST to ensure requestId is available
 * to all subsequent middleware (metrics, accessLog, errorHandler).
 */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') || generateRequestId()

  // Store in context for other middleware/handlers
  c.set('requestId', requestId)

  await next()

  // Set response header for client correlation
  c.res.headers.set('X-Request-ID', requestId)
}
