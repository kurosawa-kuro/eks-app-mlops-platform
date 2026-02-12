/**
 * In-memory rate limit store
 * For distributed systems, replace with Redis-based implementation
 */
class RateLimitStore {
    store = new Map();
    cleanupInterval;
    constructor() {
        // Cleanup expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
    get(key) {
        return this.store.get(key);
    }
    set(key, entry) {
        this.store.set(key, entry);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (entry.resetAt < now) {
                this.store.delete(key);
            }
        }
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}
// Shared store instance
const store = new RateLimitStore();
/**
 * Get client IP from request
 */
function getClientIp(c) {
    // Check common headers for proxied requests
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIp = c.req.header('x-real-ip');
    if (realIp) {
        return realIp;
    }
    // Fallback (may not work in all environments)
    return 'unknown';
}
/**
 * Create rate limiting middleware
 *
 * @example
 * // Basic usage - 100 requests per 15 minutes
 * app.use('/auth/login', createRateLimit({ max: 100, windowMs: 15 * 60 * 1000 }))
 *
 * @example
 * // Strict limit for login endpoint - 5 attempts per minute
 * app.use('/auth/login', createRateLimit({ max: 5, windowMs: 60 * 1000 }))
 */
export function createRateLimit(config) {
    const { max, windowMs, keyGenerator = getClientIp, skip } = config;
    return async (c, next) => {
        // Skip if configured
        if (skip?.(c)) {
            return next();
        }
        const key = keyGenerator(c);
        const now = Date.now();
        let entry = store.get(key);
        // Create new entry if doesn't exist or window expired
        if (!entry || entry.resetAt < now) {
            entry = {
                count: 0,
                resetAt: now + windowMs,
            };
        }
        // Increment count
        entry.count++;
        store.set(key, entry);
        // Set rate limit headers
        const remaining = Math.max(0, max - entry.count);
        const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
        c.header('X-RateLimit-Limit', String(max));
        c.header('X-RateLimit-Remaining', String(remaining));
        c.header('X-RateLimit-Reset', String(resetSeconds));
        // Check if over limit
        if (entry.count > max) {
            c.header('Retry-After', String(resetSeconds));
            return c.json({
                error: 'Too many requests',
                message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
                retryAfter: resetSeconds,
            }, 429);
        }
        return next();
    };
}
/**
 * Pre-configured rate limit for login endpoint
 * 5 attempts per minute per IP (brute-force protection)
 * Disabled in test environment for easier testing
 */
export const loginRateLimit = createRateLimit({
    max: 5,
    windowMs: 60 * 1000, // 1 minute
    skip: () => process.env.NODE_ENV === 'test',
});
/**
 * Pre-configured rate limit for general API
 * 100 requests per 15 minutes per IP
 */
export const apiRateLimit = createRateLimit({
    max: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
});
