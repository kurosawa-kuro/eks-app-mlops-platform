import { Hono } from 'hono'
import { z } from 'zod'
import { resolve } from '../../container/index.js'
import { requireRole } from '../../middleware/guard/index.js'

const adminRegister = new Hono()

// =============================================================================
// Admin-only User Registration
// =============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.enum(['user', 'admin']).default('user'),
})

/**
 * POST /api/register - Register a new user (admin only)
 *
 * This endpoint is for admin users to create new users.
 * No password is required because authentication is via JWT (external auth service).
 *
 * Request body:
 *   - email: string (required)
 *   - role: "user" | "admin" (optional, defaults to "user")
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - user: { id, email, role } (on success)
 */
adminRegister.post('/', requireRole('admin'), async (c) => {
  const userRepository = resolve('userRepository')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const validation = registerSchema.safeParse(body)
  if (!validation.success) {
    return c.json({
      success: false,
      message: 'Validation failed',
      errors: validation.error.flatten().fieldErrors,
    }, 400)
  }

  // Check if userRepository supports create
  if (!userRepository.create) {
    return c.json({
      success: false,
      message: 'User registration not supported in current storage mode',
    }, 501)
  }

  // Check if user already exists
  const existing = await userRepository.findByEmail(validation.data.email)
  if (existing) {
    return c.json({
      success: false,
      message: 'User with this email already exists',
    }, 409)
  }

  const user = await userRepository.create(validation.data.email, validation.data.role)

  return c.json({
    success: true,
    message: 'User created successfully',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  }, 201)
})

export { adminRegister }
