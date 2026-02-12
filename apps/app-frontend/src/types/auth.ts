export type UserRole = 'user' | 'admin' | 'moderator'

export interface User {
  id: string
  email: string
  role?: UserRole
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message?: string
  refresh_token?: string
  expires_in?: number
}

export interface MeResponse {
  success: boolean
  user?: User
  message?: string
}

export interface LogoutResponse {
  success: boolean
  message?: string
}
