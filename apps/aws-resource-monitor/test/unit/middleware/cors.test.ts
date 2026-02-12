import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { publicCorsMiddleware, protectedCorsMiddleware } from '../../../src/presentation/middleware/cors.js'

describe('publicCorsMiddleware', () => {
  it('should allow all origins', async () => {
    const app = new Hono()
    app.use('*', publicCorsMiddleware)
    app.get('/test', (c) => c.json({ success: true }))

    const res = await app.request('/test', {
      headers: { Origin: 'https://example.com' }
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('protectedCorsMiddleware', () => {
  it('should echo back origin in development', async () => {
    const app = new Hono()
    app.use('*', protectedCorsMiddleware)
    app.get('/test', (c) => c.json({ success: true }))

    const res = await app.request('/test', {
      headers: { Origin: 'https://myapp.com' }
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com')
  })
})
