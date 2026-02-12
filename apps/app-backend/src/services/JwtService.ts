import { sign, verify } from 'hono/jwt'
import type { IJwtService, ITokenBlacklist, EnvConfig } from '../container/types.js'
import type { AuthPayload } from '../domain/types/auth.js'

/**
 * JWT service for token creation and verification
 *
 * Supports both access tokens (short-lived) and refresh tokens (long-lived)
 * Access token TTL: ACCESS_TOKEN_TTL env var (default: 15 minutes)
 * Refresh token TTL: REFRESH_TOKEN_TTL env var (default: 7 days)
 */
export class JwtService implements IJwtService {
  constructor(
    private readonly env: EnvConfig,
    private readonly tokenBlacklist: ITokenBlacklist,
  ) {}

  async createToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const fullPayload = {
      ...payload,
      type: 'access',
      iat: now,
      exp: now + this.env.ACCESS_TOKEN_TTL,
    }
    return sign(fullPayload, this.env.JWT_SECRET)
  }

  async createRefreshToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const fullPayload = {
      ...payload,
      type: 'refresh',
      iat: now,
      exp: now + this.env.REFRESH_TOKEN_TTL,
    }
    return sign(fullPayload, this.env.JWT_SECRET)
  }

  async verifyToken(token: string): Promise<AuthPayload | null> {
    return this.verifyTokenInternal(token, 'access')
  }

  async verifyRefreshToken(token: string): Promise<AuthPayload | null> {
    return this.verifyTokenInternal(token, 'refresh')
  }

  /**
   * Internal token verification with type checking
   * DRY: Shared logic for access and refresh token verification
   *
   * @param token - JWT token string
   * @param expectedType - 'access' for access tokens (null type also accepted for legacy)
   *                       'refresh' for refresh tokens (requires explicit type)
   */
  private async verifyTokenInternal(
    token: string,
    expectedType: 'access' | 'refresh',
  ): Promise<AuthPayload | null> {
    try {
      // Check if token is blacklisted
      if (await this.tokenBlacklist.isBlacklisted(token)) {
        return null
      }

      const decoded = await verify(token, this.env.JWT_SECRET)

      // Type validation
      if (expectedType === 'access') {
        // Access tokens: accept if type is 'access' or missing (legacy support)
        if (decoded.type && decoded.type !== 'access') {
          return null
        }
      } else {
        // Refresh tokens: require explicit 'refresh' type
        if (decoded.type !== 'refresh') {
          return null
        }
      }

      return this.mapToPayload(decoded)
    } catch {
      return null
    }
  }

  /**
   * Map decoded JWT claims to AuthPayload
   */
  private mapToPayload(decoded: Record<string, unknown>): AuthPayload {
    return {
      sub: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as AuthPayload['role'],
      permissions: decoded.permissions as AuthPayload['permissions'],
      iat: decoded.iat as number,
      exp: decoded.exp as number,
    }
  }
}
