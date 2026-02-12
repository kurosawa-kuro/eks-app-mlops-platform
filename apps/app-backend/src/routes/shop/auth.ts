import { Hono } from 'hono'
import { z } from 'zod'
import { resolve } from '../../container/index.js'
import { authRateLimiter } from '../../middleware/guard/index.js'

const authRoutes = new Hono()

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
})

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
})

authRoutes.post('/login', authRateLimiter, async (c) => {
  const authService = resolve('authService')
  const cookieService = resolve('cookieService')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const validation = loginSchema.safeParse(body)
  if (!validation.success) {
    return c.json({
      success: false,
      message: 'Validation failed',
      errors: validation.error.flatten().fieldErrors,
    }, 400)
  }

  const result = await authService.login(c, validation.data)

  if (result.success && result.accessToken) {
    // Set access token in httpOnly cookie
    cookieService.setAuthToken(c, result.accessToken)

    return c.json({
      success: true,
      message: result.message,
      // access_token is NOT returned in body (managed via httpOnly cookie)
      refresh_token: result.refreshToken,
      expires_in: resolve('env').ACCESS_TOKEN_TTL,
    })
  }

  return c.json({ success: false, message: result.message }, 401)
})

authRoutes.post('/logout', async (c) => {
  const authService = resolve('authService')
  const cookieService = resolve('cookieService')

  // Clear auth token cookie
  cookieService.clearAuthToken(c)

  const result = await authService.logout(c)
  return c.json(result)
})

// Protected endpoint - reads token from httpOnly cookie
authRoutes.get('/me', async (c) => {
  const authService = resolve('authService')

  // Verify request using authService (delegates to external auth if configured)
  const payload = await authService.verifyRequest(c)
  if (!payload) {
    return c.json({ success: false, message: 'Invalid or expired token' }, 401)
  }

  return c.json({
    success: true,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    },
  })
})

authRoutes.post('/refresh', authRateLimiter, async (c) => {
  const authService = resolve('authService')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const validation = refreshSchema.safeParse(body)
  if (!validation.success) {
    return c.json({
      success: false,
      message: 'Validation failed',
      errors: validation.error.flatten().fieldErrors,
    }, 400)
  }

  const result = await authService.refresh(validation.data.refresh_token)

  if (result.success) {
    return c.json({
      success: true,
      message: result.message,
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: resolve('env').ACCESS_TOKEN_TTL,
    })
  }

  return c.json({ success: false, message: result.message }, 401)
})

export { authRoutes }
