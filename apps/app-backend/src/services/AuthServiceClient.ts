import type { AuthPayload } from '../domain/types/auth.js'
import type { ExternalLoginResult } from '../container/types.js'
import type { Logger } from 'pino'

/**
 * Client for delegating token verification to external auth service
 *
 * This allows the hono app to verify Cognito tokens by calling the
 * auth service's /auth/me endpoint.
 */
export class AuthServiceClient {
  private readonly baseUrl: string

  constructor(
    authServiceUrl: string,
    private readonly logger: Logger,
  ) {
    this.baseUrl = authServiceUrl.replace(/\/$/, '')
    this.logger.info({ authServiceUrl: this.baseUrl }, 'AuthServiceClient initialized')
  }

  async verifyToken(token: string): Promise<AuthPayload | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        this.logger.debug({ status: response.status }, 'Token verification failed')
        return null
      }

      const data = (await response.json()) as {
        authenticated: boolean
        user?: { sub: string; email: string }
      }

      if (!data.authenticated || !data.user) {
        return null
      }

      // Resolve actual email: auth gateway may return sub UUID as email
      let email = data.user.email
      if (!email?.includes('@')) {
        email = this.extractEmailFromJwt(token) || email
      }

      return {
        sub: data.user.sub,
        email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
    } catch (error) {
      this.logger.error({ error }, 'Auth service verification error')
      return null
    }
  }

  /**
   * Decode JWT payload (without verification) to extract claims.
   * Cognito access tokens may have 'username', 'email', 'cognito:groups' in their payload.
   */
  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>
    } catch {
      return null
    }
  }

  private extractEmailFromJwt(token: string): string | null {
    const payload = this.decodeJwtPayload(token)
    if (!payload) return null

    const email = payload.email as string | undefined
    const username = (payload['cognito:username'] ?? payload.username) as string | undefined

    if (email?.includes('@')) return email
    if (username?.includes('@')) return username

    return null
  }

  /**
   * Extract role from JWT cognito:groups claim.
   * If user belongs to 'admin' group, returns 'admin'.
   */
  extractRoleFromJwt(token: string): 'admin' | 'user' {
    const payload = this.decodeJwtPayload(token)
    if (!payload) return 'user'

    const groups = payload['cognito:groups'] as string[] | undefined
    if (Array.isArray(groups) && groups.includes('admin')) return 'admin'

    return 'user'
  }

  /**
   * Delegate login to external auth service
   */
  async login(credentials: { email: string; password: string }): Promise<ExternalLoginResult> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.email, // auth-gateway expects 'username'
          password: credentials.password,
        }),
      })

      const data = await response.json() as {
        success?: boolean
        message?: string
        access_token?: string
        refresh_token?: string
        expires_in?: number
      }

      if (!response.ok) {
        this.logger.debug({ status: response.status, message: data.message }, 'Login failed')
        return {
          success: false,
          message: data.message || 'Login failed',
        }
      }

      this.logger.info({ email: credentials.email }, 'Login delegated to auth service')

      return {
        success: true,
        message: 'Login successful',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      }
    } catch (error) {
      this.logger.error({ error }, 'Auth service login error')
      return {
        success: false,
        message: 'Auth service unavailable',
      }
    }
  }
}
