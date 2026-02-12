/**
 * Observability Middleware Stack
 *
 * Provides comprehensive request/response monitoring:
 * - requestIdMiddleware: Assigns unique ID for distributed tracing
 * - metricsMiddleware: Records Prometheus metrics
 * - accessLogMiddleware: Logs to Console/Firehose based on LOG_MODE
 * - errorHandler: Handles errors and sends to CloudWatch
 *
 * Recommended order in app.ts:
 * 1. app.onError(errorHandler)     // Catches all errors
 * 2. app.use('*', requestIdMiddleware)  // First, assigns requestId
 * 3. app.use('*', metricsMiddleware)    // Records request count
 * 4. app.use('*', accessLogMiddleware)  // Logs request/response
 */

export { requestIdMiddleware } from './requestIdMiddleware.js'
export { metricsMiddleware } from './metricsMiddleware.js'
export { accessLogMiddleware } from './accessLogMiddleware.js'
export { errorHandler } from './errorHandler.js'
