import { api } from './fetcher'
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutResponse,
} from '@/types/auth'

/**
 * Note: Auth API responses return { success, user/message } directly,
 * NOT wrapped in { success, data: {...} }
 */
export const authApi = {
  /**
   * Login
   * - On success: Cookie httpOnly access token is set
   * - refresh_token is for future use (not used in Phase 1)
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return api.post<LoginResponse>('/api/auth/login', data) as Promise<LoginResponse>
  },

  /**
   * Logout
   * - Clears Cookie + adds token to blacklist
   */
  logout: async (): Promise<LogoutResponse> => {
    return api.post<LogoutResponse>('/api/auth/logout') as Promise<LogoutResponse>
  },

  /**
   * Check auth state
   * - The "source of truth" for auth state
   * - Reads token from httpOnly Cookie and returns user info
   */
  me: async (): Promise<MeResponse> => {
    return api.get<MeResponse>('/api/auth/me') as Promise<MeResponse>
  },

  /**
   * Token refresh (for Phase 2+)
   * - Currently unused
   */
  refresh: async (refreshToken: string): Promise<LoginResponse> => {
    return api.post<LoginResponse>('/api/auth/refresh', {
      refresh_token: refreshToken
    }) as Promise<LoginResponse>
  },
}
