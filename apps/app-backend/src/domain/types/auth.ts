/**
 * User role in the system
 */
export type UserRole = 'user' | 'admin' | 'moderator'

/**
 * Available permissions in the system
 */
export type Permission =
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'read:analytics'
  | 'write:analytics'
  | 'admin:system'

/**
 * User entity representing a registered user in the system
 */
export interface User {
  id: string
  email: string
  passwordHash: string
  role?: UserRole
  permissions?: Permission[]
}

/**
 * Credentials for authentication requests
 */
export interface Credentials {
  email: string
  password: string
}

/**
 * JWT payload structure for authentication tokens
 */
export interface AuthPayload {
  sub: string
  email: string
  role?: UserRole
  permissions?: Permission[]
  iat: number
  exp: number
}

/**
 * Result of login/logout operations
 */
export interface LoginResult {
  success: boolean
  message: string
}
