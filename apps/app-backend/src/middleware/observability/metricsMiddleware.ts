import type { MiddlewareHandler } from 'hono'
import { resolve } from '../../container/index.js'

/**
 * Metrics Middleware
 *
 * Records request/response metrics for Prometheus monitoring.
 * - Counts total HTTP requests
 * - Counts errors (status >= 400)
 *
 * Future enhancements:
 * - Duration histograms
 * - Path-based metrics
 * - OpenTelemetry integration
 */
export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const metricsService = resolve('metricsService')
  metricsService.recordRequest()

  await next()

  if (c.res.status >= 400) {
    metricsService.recordError()
  }
}
