import { describe, it, expect, vi } from 'vitest'

// Mock ejs
vi.mock('ejs', () => ({
  renderFile: vi.fn().mockResolvedValue('<html><body>Test</body></html>')
}))

// Mock clerk
vi.mock('@hono/clerk-auth', () => ({
  getAuth: vi.fn(() => null)
}))

// Mock env
vi.mock('../../../src/env/index.js', () => ({
  appConfig: {
    internalApiKey: '',
    authEnabled: false,
    authClerkPublishableKey: ''
  }
}))

import { render } from '../../../src/presentation/helpers/render.js'
import { Hono } from 'hono'

describe('render', () => {
  it('should render template and return HTML response', async () => {
    const app = new Hono()
    app.get('/test', async (c) => {
      return render(c, 'test/template', { title: 'Test' })
    })

    const res = await app.request('/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
  })
})
