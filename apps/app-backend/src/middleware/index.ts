/**
 * Middleware Layer
 *
 * Organized into two categories:
 *
 * 1. Observability (monitoring & logging)
 *    - requestIdMiddleware
 *    - metricsMiddleware
 *    - accessLogMiddleware
 *    - errorHandler
 *
 * 2. Guard (protection & access control)
 *    - authRequired
 *    - rateLimiter
 *    - authRateLimiter
 *    - apiRateLimiter
 */

// Observability
export {
  requestIdMiddleware,
  metricsMiddleware,
  accessLogMiddleware,
  errorHandler,
} from './observability/index.js'

// Guard
export {
  authRequired,
  rateLimiter,
  authRateLimiter,
  apiRateLimiter,
  type AuthPayload,
} from './guard/index.js'
