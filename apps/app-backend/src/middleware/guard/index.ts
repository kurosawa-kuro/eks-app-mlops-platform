/**
 * Guard Middleware Stack
 *
 * Provides request protection and access control:
 *
 * Authentication:
 * - authRequired(): JWT-based authentication (returns 401 or redirects)
 * - optionalAuth(): Tries to authenticate but allows guest access
 *
 * Authorization:
 * - roleRequired('admin'): Role-based access control
 * - permissionRequired(['read:users']): Permission-based access control
 * - requireRole('admin'): Combined auth + role guard
 * - requirePermission(['read:users']): Combined auth + permission guard
 *
 * Rate Limiting:
 * - rateLimiter: Configurable rate limiting factory
 * - authRateLimiter: Strict rate limiting for auth endpoints
 * - apiRateLimiter: General API rate limiting
 */

// Authentication & Authorization
export {
  // Middleware factories
  authRequired,
  optionalAuth,
  roleRequired,
  permissionRequired,
  // Convenience combined guards
  requireRole,
  requirePermission,
  // Types
  type AuthPayload,
  type UserRole,
  type Permission,
  type AuthVariables,
  type AuthRequiredOptions,
} from './auth.js'

// Rate Limiting
export { rateLimiter, authRateLimiter, apiRateLimiter } from './rateLimiter.js'
