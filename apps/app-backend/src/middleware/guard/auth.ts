import type { Context, Next, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { resolve } from '../../container/index.js'
import type { IAuthService } from '../../container/types.js'
import type { AuthPayload, UserRole, Permission } from '../../domain/types/auth.js'

// Re-export types for convenience
export type { AuthPayload, UserRole, Permission } from '../../domain/types/auth.js'

/**
 * Auth context variables for typed access
 */
export interface AuthVariables {
  user: AuthPayload
}

/**
 * Options for authRequired middleware
 */
export interface AuthRequiredOptions {
  /** Redirect URL for unauthenticated requests (default: returns 401) */
  redirectTo?: string
}

/**
 * Authentication Middleware Factory with explicit dependency injection
 *
 * Creates a middleware that requires authentication.
 * This pattern enables unit testing with mock authService.
 *
 * @param authService - Auth service instance for token verification
 * @param options - Middleware options
 * @returns MiddlewareHandler
 */
export function createAuthRequired(
  authService: IAuthService,
  options: AuthRequiredOptions = {},
): MiddlewareHandler {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const payload = await authService.verifyRequest(c)

    if (!payload) {
      if (options.redirectTo) {
        return c.redirect(options.redirectTo)
      }
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    c.set('user', payload)
    await next()
  }
}

/**
 * Authentication Middleware Factory (backward compatible)
 *
 * Uses DI container to resolve authService.
 * For new code, prefer createAuthRequired() with explicit injection.
 *
 * Usage:
 *   app.use('/api/*', authRequired())
 *   app.use('/dashboard/*', authRequired({ redirectTo: '/login' }))
 */
export function authRequired(options: AuthRequiredOptions = {}): MiddlewareHandler {
  const authService = resolve('authService')
  return createAuthRequired(authService, options)
}

/**
 * Optional Authentication Middleware Factory
 *
 * Attempts to authenticate the user but allows request to proceed even if not authenticated.
 * Sets c.get('user') to the AuthPayload if authenticated, or undefined if not.
 *
 * Use this for pages that:
 * - Are accessible to guests (non-logged-in users)
 * - But show different content for logged-in users
 *
 * Usage:
 *   app.get('/shop/products', optionalAuth(), handler)  // Guest can view, user gets context
 */
export function optionalAuth(): MiddlewareHandler {
  const authService = resolve('authService')

  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const payload = await authService.verifyRequest(c)

    if (payload) {
      c.set('user', payload)
    }
    // Continue regardless of auth status
    await next()
  }
}

/**
 * Role-based Authorization Middleware Factory
 *
 * Creates a middleware that requires a specific role.
 * Must be used AFTER authRequired() middleware.
 *
 * Usage:
 *   app.use('/admin/*', authRequired(), roleRequired('admin'))
 *   app.use('/mod/*', authRequired(), roleRequired(['admin', 'moderator']))
 */
export function roleRequired(
  allowedRoles: UserRole | UserRole[]
): MiddlewareHandler {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    const userRole = user.role ?? 'user'

    if (!roles.includes(userRole)) {
      throw new HTTPException(403, {
        message: `Role '${userRole}' is not authorized. Required: ${roles.join(' or ')}`,
      })
    }

    await next()
  }
}

/**
 * Permission-based Authorization Middleware Factory
 *
 * Creates a middleware that requires specific permissions.
 * Must be used AFTER authRequired() middleware.
 *
 * By default, requires ALL specified permissions.
 * Use { requireAll: false } to require ANY of the permissions.
 *
 * Usage:
 *   app.use('/users/*', authRequired(), permissionRequired(['read:users']))
 *   app.use('/admin/*', authRequired(), permissionRequired(['admin:system']))
 *   app.get('/data', authRequired(), permissionRequired(['read:users', 'read:analytics'], { requireAll: false }))
 */
export function permissionRequired(
  requiredPermissions: Permission[],
  options: { requireAll?: boolean } = {}
): MiddlewareHandler {
  const { requireAll = true } = options

  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    const userPermissions = user.permissions ?? []

    const hasPermission = requireAll
      ? requiredPermissions.every(p => userPermissions.includes(p))
      : requiredPermissions.some(p => userPermissions.includes(p))

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Required: ${requiredPermissions.join(requireAll ? ' AND ' : ' OR ')}`,
      })
    }

    await next()
  }
}

/**
 * Combined Auth + Role Guard Factory
 *
 * Convenience function that combines authRequired and roleRequired.
 *
 * Usage:
 *   app.use('/admin/*', requireRole('admin'))
 */
export function requireRole(
  allowedRoles: UserRole | UserRole[],
  authOptions: AuthRequiredOptions = {}
): MiddlewareHandler {
  const authMw = authRequired(authOptions)
  const roleMw = roleRequired(allowedRoles)

  return async (c, next) => {
    // Run authRequired first
    let authCalled = false
    const authResult = await authMw(c, async () => {
      authCalled = true
    })

    // If auth middleware returned a response (e.g., redirect), return it
    if (!authCalled) {
      return authResult
    }

    // Then run roleRequired
    await roleMw(c, next)
  }
}

/**
 * Combined Auth + Permission Guard Factory
 *
 * Convenience function that combines authRequired and permissionRequired.
 *
 * Usage:
 *   app.use('/analytics/*', requirePermission(['read:analytics']))
 */
export function requirePermission(
  requiredPermissions: Permission[],
  options: { requireAll?: boolean; auth?: AuthRequiredOptions } = {}
): MiddlewareHandler {
  const { requireAll = true, auth = {} } = options
  const authMw = authRequired(auth)
  const permMw = permissionRequired(requiredPermissions, { requireAll })

  return async (c, next) => {
    // Run authRequired first
    let authCalled = false
    const authResult = await authMw(c, async () => {
      authCalled = true
    })

    // If auth middleware returned a response (e.g., redirect), return it
    if (!authCalled) {
      return authResult
    }

    // Then run permissionRequired
    await permMw(c, next)
  }
}
