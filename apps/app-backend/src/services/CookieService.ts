import type { Context } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import type { ICookieService, EnvConfig } from '../container/types.js'

/**
 * Cookie service for authentication token management
 */
export class CookieService implements ICookieService {
  private readonly isProduction: boolean
  private readonly accessTokenTtl: number

  constructor(env: EnvConfig) {
    this.isProduction = env.NODE_ENV === 'production'
    this.accessTokenTtl = env.ACCESS_TOKEN_TTL
  }

  setAuthToken(c: Context, token: string): void {
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'None' : 'Lax',
      maxAge: this.accessTokenTtl,
      path: '/',
    })
  }

  clearAuthToken(c: Context): void {
    deleteCookie(c, 'auth_token', {
      path: '/',
      secure: this.isProduction,
      sameSite: this.isProduction ? 'None' : 'Lax',
    })
  }

  getAuthToken(c: Context): string | undefined {
    return getCookie(c, 'auth_token')
  }
}
