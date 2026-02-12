'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectIsInitialized,
} from '@/stores/authStore'

interface UseAuthOptions {
  /** Whether authentication is required (default: true) */
  required?: boolean
  /** Redirect path when not authenticated (default: /login) */
  redirectTo?: string
  /** Required role (if specified, only that role can access) */
  requiredRole?: 'user' | 'admin'
}

/**
 * Authentication hook
 *
 * @example
 * // Auth required page
 * const { user, isLoading } = useAuth()
 *
 * @example
 * // Admin only page
 * const { user } = useAuth({ requiredRole: 'admin', redirectTo: '/dashboard' })
 *
 * @example
 * // Optional auth (guest viewable)
 * const { user, isAuthenticated } = useAuth({ required: false })
 */
export function useAuth(options: UseAuthOptions = {}) {
  const {
    required = true,
    redirectTo = '/login',
    requiredRole,
  } = options

  const router = useRouter()

  // Use selectors for optimization
  const user = useAuthStore(selectUser)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const isLoading = useAuthStore(selectIsLoading)
  const isInitialized = useAuthStore(selectIsInitialized)
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const logout = useAuthStore((s) => s.logout)

  // Check auth state on initial mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      checkAuth()
    }
  }, [isInitialized, isLoading, checkAuth])

  // Redirect if auth is required but not authenticated
  useEffect(() => {
    if (!isInitialized) return

    if (required && !user) {
      router.push(redirectTo)
      return
    }

    // Role restriction check
    if (requiredRole && user?.role !== requiredRole) {
      router.push(redirectTo)
    }
  }, [isInitialized, required, user, requiredRole, redirectTo, router])

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    logout,

    // Convenience getters
    isAdmin: user?.role === 'admin',
  }
}
