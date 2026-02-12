import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app.js'
import { createTestContainer } from '../helpers/container.js'

describe('Hono API', () => {
  const app = createApp(createTestContainer())

  it('GET / should redirect to /aws', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/aws')
  })

  it('GET /api/health should return status ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json).toHaveProperty('timestamp')
  })
})
