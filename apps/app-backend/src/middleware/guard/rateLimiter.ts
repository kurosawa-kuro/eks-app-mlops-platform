import type { Context, Next, MiddlewareHandler } from 'hono'
import { resolve } from '../../container/index.js'
import type { IRateLimitStore } from '../../container/types.js'

interface RateLimiterOptions {
  windowMs: number
  maxRequests: number
  message?: string
  keyGenerator?: (c: Context) => string
}

const DEFAULT_OPTIONS: Required<RateLimiterOptions> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later',
  keyGenerator: (c: Context) => {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    return c.req.header('x-real-ip') || 'unknown'
  },
}

/**
 * Rate Limiter Factory with explicit store injection
 *
 * Creates a rate limiting middleware with configurable options.
 * This pattern enables:
 * - Unit testing with mock stores
 * - No hidden resolve() calls
 * - Clear dependency graph
 *
 * @param store - Rate limit store instance (InMemory or Redis)
 * @param options - Configuration options
 * @returns MiddlewareHandler
 */
export function createRateLimiter(
  store: IRateLimitStore,
  options: Partial<RateLimiterOptions> = {},
): MiddlewareHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Start cleanup timer if the store supports it
  store.startCleanup?.(opts.windowMs)

  return async (c: Context, next: Next) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === 'development') {
      return next()
    }
    const key = opts.keyGenerator(c)
    const now = Date.now()

    let entry = store.get(key)

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 1,
        resetTime: now + opts.windowMs,
      }
      store.set(key, entry)
    } else {
      entry.count++
      store.set(key, entry) // Update the entry in store
    }

    // Set rate limit headers
    const remaining = Math.max(0, opts.maxRequests - entry.count)
    const reset = Math.ceil(entry.resetTime / 1000)

    c.header('X-RateLimit-Limit', String(opts.maxRequests))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(reset))

    if (entry.count > opts.maxRequests) {
      c.header('Retry-After', String(Math.ceil((entry.resetTime - now) / 1000)))
      return c.json({ success: false, message: opts.message }, 429)
    }

    await next()
  }
}

/**
 * Rate Limiter Factory (backward compatible)
 *
 * Uses DI container to resolve store. For new code, prefer
 * createRateLimiter() with explicit store injection.
 *
 * @param options - Configuration options
 * @returns MiddlewareHandler
 */
export function rateLimiter(
  options: Partial<RateLimiterOptions> = {},
): MiddlewareHandler {
  const store = resolve('rateLimitStore')
  return createRateLimiter(store, options)
}

/**
 * Stricter rate limiter for authentication endpoints
 * 5 requests per 15 minutes
 */
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many login attempts, please try again later',
})

/**
 * General API rate limiter
 * 100 requests per minute
 */
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later',
})
