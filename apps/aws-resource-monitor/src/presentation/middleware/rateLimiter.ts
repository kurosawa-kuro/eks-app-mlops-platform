import { rateLimiter } from 'hono-rate-limiter'
import type { Context } from 'hono'
import { appConfig } from '../../env/index.js'

// Rate limiter configuration
// Configurable via RATE_LIMIT_PER_MINUTE environment variable or config.json
export const rateLimiterMiddleware = rateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  limit: appConfig.rateLimitPerMinute,
  standardHeaders: 'draft-6', // Use standard rate limit headers
  keyGenerator: (c: Context) => {
    // Use X-Forwarded-For header if behind a proxy, otherwise use remote address
    return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
           c.req.header('x-real-ip') ||
           'unknown'
  },
  handler: (c: Context) => {
    return c.json(
      {
        error: 'Too many requests',
        status: 429,
        retryAfter: c.res.headers.get('Retry-After')
      },
      429
    )
  }
})
