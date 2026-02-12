import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

// Mock logger before importing requestLogger
vi.mock('../../../src/shared/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock requestId generator
vi.mock('../../../src/shared/requestId.js', () => ({
  generateRequestId: vi.fn(() => 'req_test_123')
}))

import { requestLogger } from '../../../src/presentation/middleware/requestLogger.js'

describe('requestLogger', () => {
  it('should add X-Request-Id header to response', async () => {
    const app = new Hono()

    app.use('*', requestLogger)
    app.get('/test', (c) => c.json({ success: true }))

    const res = await app.request('/test')

    expect(res.headers.get('X-Request-Id')).toBe('req_test_123')
  })

  it('should use provided X-Request-Id from request', async () => {
    const app = new Hono()

    app.use('*', requestLogger)
    app.get('/test', (c) => c.json({ success: true }))

    const res = await app.request('/test', {
      headers: { 'X-Request-Id': 'custom-id-456' }
    })

    expect(res.headers.get('X-Request-Id')).toBe('custom-id-456')
  })
})
