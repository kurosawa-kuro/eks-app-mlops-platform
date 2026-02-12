import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { Hono } from 'hono'
import type { AuthPayload } from '../../../src/domain/types/auth.js'
import type { AuthVariables } from '../../../src/middleware/guard/auth.js'

// App type with auth variables for tests
type TestApp = Hono<{ Variables: AuthVariables }>

// Mock the container module
const mockAuthService = {
  verifyRequest: jest.fn<() => Promise<AuthPayload | null>>(),
}

jest.unstable_mockModule('../../../src/container/index.js', () => ({
  resolve: (name: string) => {
    if (name === 'authService') return mockAuthService
    throw new Error(`Unknown service: ${name}`)
  },
}))

// Import after mocking
const { authRequired, roleRequired, permissionRequired, requireRole, requirePermission } =
  await import('../../../src/middleware/guard/auth.js')

describe('Authorization Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authRequired', () => {
    it('should allow authenticated requests', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.get('/test', (c) => c.json({ user: c.get('user') }))

      const res = await app.request('/test')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('test@example.com')
    })

    it('should return 401 for unauthenticated requests', async () => {
      const app: TestApp = new Hono()
      mockAuthService.verifyRequest.mockResolvedValue(null)

      app.use('/*', authRequired())
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test')
      expect(res.status).toBe(401)
    })

    it('should redirect when redirectTo option is set', async () => {
      const app: TestApp = new Hono()
      mockAuthService.verifyRequest.mockResolvedValue(null)

      app.use('/*', authRequired({ redirectTo: '/login' }))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test')
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/login')
    })
  })

  describe('roleRequired', () => {
    it('should allow users with matching role', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', roleRequired('admin'))
      app.get('/admin', (c) => c.json({ success: true }))

      const res = await app.request('/admin')
      expect(res.status).toBe(200)
    })

    it('should allow users with any of the allowed roles', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'mod-1',
        email: 'mod@example.com',
        role: 'moderator',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', roleRequired(['admin', 'moderator']))
      app.get('/mod', (c) => c.json({ success: true }))

      const res = await app.request('/mod')
      expect(res.status).toBe(200)
    })

    it('should return 403 for users without matching role', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', roleRequired('admin'))
      app.get('/admin', (c) => c.json({ success: true }))

      const res = await app.request('/admin')
      expect(res.status).toBe(403)
    })

    it('should default to user role when role is not set', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', roleRequired('user'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test')
      expect(res.status).toBe(200)
    })
  })

  describe('permissionRequired', () => {
    it('should allow users with required permission', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', permissionRequired(['read:analytics']))
      app.get('/analytics', (c) => c.json({ success: true }))

      const res = await app.request('/analytics')
      expect(res.status).toBe(200)
    })

    it('should require ALL permissions by default', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', permissionRequired(['read:analytics', 'write:analytics']))
      app.get('/analytics', (c) => c.json({ success: true }))

      const res = await app.request('/analytics')
      expect(res.status).toBe(403)
    })

    it('should allow ANY permission when requireAll is false', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', permissionRequired(['read:analytics', 'write:analytics'], { requireAll: false }))
      app.get('/analytics', (c) => c.json({ success: true }))

      const res = await app.request('/analytics')
      expect(res.status).toBe(200)
    })

    it('should return 403 for users without required permissions', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', authRequired())
      app.use('/*', permissionRequired(['admin:system']))
      app.get('/system', (c) => c.json({ success: true }))

      const res = await app.request('/system')
      expect(res.status).toBe(403)
    })
  })

  describe('requireRole (combined guard)', () => {
    it('should combine auth and role check', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', requireRole('admin'))
      app.get('/admin', (c) => c.json({ success: true }))

      const res = await app.request('/admin')
      expect(res.status).toBe(200)
    })

    it('should return 401 when not authenticated', async () => {
      const app: TestApp = new Hono()
      mockAuthService.verifyRequest.mockResolvedValue(null)

      app.use('/*', requireRole('admin'))
      app.get('/admin', (c) => c.json({ success: true }))

      const res = await app.request('/admin')
      expect(res.status).toBe(401)
    })
  })

  describe('requirePermission (combined guard)', () => {
    it('should combine auth and permission check', async () => {
      const app: TestApp = new Hono()
      const payload: AuthPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read:analytics'],
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      mockAuthService.verifyRequest.mockResolvedValue(payload)

      app.use('/*', requirePermission(['read:analytics']))
      app.get('/analytics', (c) => c.json({ success: true }))

      const res = await app.request('/analytics')
      expect(res.status).toBe(200)
    })

    it('should return 401 when not authenticated', async () => {
      const app: TestApp = new Hono()
      mockAuthService.verifyRequest.mockResolvedValue(null)

      app.use('/*', requirePermission(['read:analytics']))
      app.get('/analytics', (c) => c.json({ success: true }))

      const res = await app.request('/analytics')
      expect(res.status).toBe(401)
    })
  })
})
