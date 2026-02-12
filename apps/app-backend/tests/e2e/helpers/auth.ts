import type { BrowserContext } from '@playwright/test'
import { sign } from 'hono/jwt'

// JWT secret for development/test (must match src/config/.env)
const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-key-change-me-32chars!'

/**
 * Create a signed JWT token for testing
 */
export async function createTestToken(options: {
  userId?: string
  email?: string
  role?: 'user' | 'admin'
} = {}): Promise<string> {
  const { userId = 'test-user-1', email = 'test@example.com', role = 'user' } = options

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: userId,
    email,
    role,
    type: 'access',
    iat: now,
    exp: now + 3600, // 1 hour
  }

  return sign(payload, JWT_SECRET)
}

/**
 * Set authentication cookie in Playwright context
 */
export async function loginAsUser(
  context: BrowserContext,
  options: { userId?: string; email?: string; role?: 'user' | 'admin' } = { role: 'user' }
): Promise<void> {
  const token = await createTestToken({ role: 'user', ...options })

  await context.addCookies([
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // false for localhost
      sameSite: 'Strict',
    },
  ])
}

/**
 * Login as admin user
 */
export async function loginAsAdmin(context: BrowserContext): Promise<void> {
  await loginAsUser(context, {
    userId: 'admin-user-1',
    email: 'admin@example.com',
    role: 'admin',
  })
}

/**
 * Clear authentication cookies
 */
export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies()
}
