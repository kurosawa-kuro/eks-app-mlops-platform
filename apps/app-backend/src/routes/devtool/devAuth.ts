import { Hono } from 'hono'
import { z } from 'zod'
import { resolve } from '../../container/index.js'

/**
 * Development-only authentication routes
 *
 * These routes bypass normal authentication and issue JWTs directly
 * for testing purposes. They are completely disabled in production.
 *
 * Available test users:
 * - admin@example.com (role: admin)
 * - user@example.com (role: user)
 *
 * Password is ignored - any password works in development mode.
 */

const devtoolDevAuth = new Hono()

const DEV_USERS = {
  'admin@example.com': {
    id: 'dev-admin-id',
    email: 'admin@example.com',
    role: 'admin',
  },
  'user@example.com': {
    id: 'dev-user-id',
    email: 'user@example.com',
    role: 'user',
  },
} as const

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // Required but not validated
})

/**
 * POST /api/dev/login
 *
 * Development-only login endpoint that issues JWTs for test users.
 * Password is not validated - any value works.
 */
devtoolDevAuth.post('/login', async (c) => {
  const env = resolve('env')
  const logger = resolve('logger')

  // Strict production guard
  if (env.NODE_ENV === 'production') {
    logger.warn('Attempted to access dev auth in production')
    return c.json({ success: false, message: 'Not found' }, 404)
  }

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

  const { email } = validation.data
  const devUser = DEV_USERS[email as keyof typeof DEV_USERS]

  if (!devUser) {
    return c.json({
      success: false,
      message: 'Unknown dev user. Available: admin@example.com, user@example.com',
    }, 401)
  }

  const jwtService = resolve('jwtService')
  const cookieService = resolve('cookieService')

  const tokenPayload = {
    sub: devUser.id,
    email: devUser.email,
    role: devUser.role,
  }

  const [accessToken, refreshToken] = await Promise.all([
    jwtService.createToken(tokenPayload),
    jwtService.createRefreshToken(tokenPayload),
  ])

  cookieService.setAuthToken(c, accessToken)

  logger.info({ userId: devUser.id, email: devUser.email }, '[DEV] Test user logged in')

  return c.json({
    success: true,
    message: `[DEV] Logged in as ${devUser.email} (${devUser.role})`,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: env.ACCESS_TOKEN_TTL,
    user: {
      id: devUser.id,
      email: devUser.email,
      role: devUser.role,
    },
  })
})

/**
 * GET /api/dev/users
 *
 * List available test users (development only)
 */
devtoolDevAuth.get('/users', (c) => {
  const env = resolve('env')

  if (env.NODE_ENV === 'production') {
    return c.json({ success: false, message: 'Not found' }, 404)
  }

  return c.json({
    success: true,
    message: 'Available dev users (any password works)',
    users: Object.values(DEV_USERS).map(u => ({
      email: u.email,
      role: u.role,
    })),
  })
})

export { devtoolDevAuth }
