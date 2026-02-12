import type { Context } from 'hono'
import type { Logger } from 'pino'
import type {
  IAuthService,
  IAuthServiceClient,
  IJwtService,
  ICookieService,
  IUserRepository,
  ITokenBlacklist,
  EnvConfig,
  LoginResultWithTokens,
  RefreshResult,
} from '../container/types.js'
import type { Credentials, AuthPayload, LoginResult } from '../domain/types/auth.js'

/**
 * Authentication service handling login, logout, token verification, and refresh
 *
 * When authServiceClient is provided (via DI), authentication is delegated
 * to the external auth service (e.g., Cognito via auth-gateway).
 */
export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: IJwtService,
    private readonly cookieService: ICookieService,
    private readonly tokenBlacklist: ITokenBlacklist,
    private readonly env: EnvConfig,
    private readonly logger: Logger,
    private readonly authServiceClient: IAuthServiceClient | null,
  ) {
    if (this.authServiceClient) {
      this.logger.info('Authentication delegated to external auth service')
    }
  }

  async login(c: Context, credentials: Credentials): Promise<LoginResultWithTokens> {
    // Delegate to external auth service if configured (e.g., Cognito)
    if (this.authServiceClient) {
      const result = await this.authServiceClient.login(credentials)

      if (result.success && result.accessToken) {
        this.cookieService.setAuthToken(c, result.accessToken)

        // Ensure local DB user exists for role resolution in verifyRequest()
        try {
          const existing = await this.userRepository.findByEmail(credentials.email)
          if (!existing && this.userRepository.create) {
            await this.userRepository.create(credentials.email)
            this.logger.info({ email: credentials.email }, 'Created local user record for external auth')
          }
        } catch (e) {
          this.logger.warn({ error: e }, 'Failed to ensure local user record (non-fatal)')
        }

        this.logger.info({ email: credentials.email }, 'User logged in via external auth')
      }

      return {
        success: result.success,
        message: result.message,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }
    }

    // Fallback: Local DB authentication (for testing without external auth)
    const user = await this.userRepository.validateCredentials(credentials)

    if (!user) {
      // Development mode fallback: allow test users
      if (this.env.NODE_ENV !== 'production') {
        const devUser = this.getDevUser(credentials.email)
        if (devUser) {
          const tokenPayload = {
            sub: devUser.id,
            email: devUser.email,
            role: devUser.role,
            permissions: [],
          }

          const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.createToken(tokenPayload),
            this.jwtService.createRefreshToken(tokenPayload),
          ])

          this.cookieService.setAuthToken(c, accessToken)
          this.logger.info({ userId: devUser.id }, '[DEV] User logged in via dev fallback')

          return {
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
          }
        }
      }

      this.logger.debug({ email: credentials.email }, 'Login failed: invalid credentials')
      return { success: false, message: 'Invalid email or password' }
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.createToken(tokenPayload),
      this.jwtService.createRefreshToken(tokenPayload),
    ])

    this.cookieService.setAuthToken(c, accessToken)
    this.logger.info({ userId: user.id }, 'User logged in via local DB')

    return {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
    }
  }

  async logout(c: Context): Promise<LoginResult> {
    // Try to get token from cookie first, then fall back to Authorization header
    let token = this.cookieService.getAuthToken(c)

    if (!token) {
      const authHeader = c.req.header('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      }
    }

    if (token) {
      // Add the token to the blacklist with its expiration time
      const expiresAt = new Date(Date.now() + this.env.ACCESS_TOKEN_TTL * 1000)
      await this.tokenBlacklist.add(token, expiresAt)
    }

    this.cookieService.clearAuthToken(c)
    return { success: true, message: 'Logout successful' }
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.jwtService.verifyRefreshToken(refreshToken)

    if (!payload) {
      return { success: false, message: 'Invalid or expired refresh token' }
    }

    const accessToken = await this.jwtService.createToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    })

    return {
      success: true,
      message: 'Token refreshed',
      accessToken,
    }
  }

  async verifyRequest(c: Context): Promise<AuthPayload | null> {
    const token = this.cookieService.getAuthToken(c)
    if (!token) return null

    let payload: AuthPayload | null = null

    if (this.authServiceClient) {
      payload = await this.authServiceClient.verifyToken(token)
    } else {
      payload = await this.jwtService.verifyToken(token)
    }

    if (!payload) return null

    // Resolve email from DB if payload.email is a UUID (Cognito access tokens lack email claim)
    if (!payload.email?.includes('@')) {
      const dbUser = await this.userRepository.findByEmail(payload.email)
        ?? await this.userRepository.findById?.(payload.sub)
      if (dbUser?.email?.includes('@')) {
        payload.email = dbUser.email
      }
    }

    // Force admin role for known admin emails
    const ADMIN_EMAILS = ['admin@example.com', 'admin-readonly@example.com']
    if (ADMIN_EMAILS.includes(payload.email)) {
      payload.role = 'admin'
    } else if (!payload.role) {
      payload.role = 'user'
    }

    return payload
  }

  /**
   * Development-only: Get dev user by email
   * These users bypass normal authentication for local development/testing
   */
  private getDevUser(email: string): { id: string; email: string; role: 'user' | 'admin' } | null {
    const DEV_USERS: Record<string, { id: string; email: string; role: 'user' | 'admin' }> = {
      'admin@example.com': {
        id: 'dev-admin-id',
        email: 'admin@example.com',
        role: 'admin',
      },
      'user1@example.com': {
        id: 'dev-user1-id',
        email: 'user1@example.com',
        role: 'user',
      },
      'user2@example.com': {
        id: 'dev-user2-id',
        email: 'user2@example.com',
        role: 'user',
      },
    }
    return DEV_USERS[email] || null
  }
}
