import { describe, it, expect } from 'vitest'
import { rateLimiterMiddleware } from '../../../src/presentation/middleware/rateLimiter.js'

describe('rateLimiterMiddleware', () => {
  it('should be a middleware function', () => {
    expect(rateLimiterMiddleware).toBeDefined()
    expect(typeof rateLimiterMiddleware).toBe('function')
  })
})
