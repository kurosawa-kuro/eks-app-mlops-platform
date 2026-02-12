'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/auth'
import { authApi } from '@/lib/api/auth'

interface AuthState {
  // State
  user: User | null
  isLoading: boolean
  isInitialized: boolean

  // Phase 2 (currently unused)
  refreshToken: string | null

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  reset: () => void
}

const initialState = {
  user: null,
  isLoading: false,
  isInitialized: false,
  refreshToken: null,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Login process
       * 1. POST /api/auth/login
       * 2. On success: Cookie is set (by BE)
       * 3. GET /api/auth/me to get user info
       */
      login: async (email, password) => {
        set({ isLoading: true })

        try {
          const result = await authApi.login({ email, password })

          if (!result.success) {
            set({ isLoading: false })
            return {
              success: false,
              error: result.message || 'Login failed'
            }
          }

          // refresh_token is for Phase 2 (save only for now)
          if (result.refresh_token) {
            set({ refreshToken: result.refresh_token })
          }

          // Get user info (reset isLoading first to avoid early return in checkAuth)
          set({ isLoading: false })
          await get().checkAuth()

          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      },

      /**
       * Logout process
       * 1. POST /api/auth/logout (clears Cookie)
       * 2. Reset local state
       */
      logout: async () => {
        set({ isLoading: true })

        try {
          await authApi.logout()
        } catch {
          // Ignore logout errors (always reset local state)
        } finally {
          set({
            user: null,
            isLoading: false,
            refreshToken: null,
          })
        }
      },

      /**
       * Check auth state
       * - Calls GET /api/auth/me
       * - 401: user=null (not authenticated)
       * - 200: sets user info
       */
      checkAuth: async () => {
        // Prevent duplicate calls
        if (get().isLoading) {
          return
        }

        set({ isLoading: true })

        try {
          const result = await authApi.me()

          if (result.success && result.user) {
            set({
              user: result.user,
              isLoading: false,
              isInitialized: true,
            })
          } else {
            // 401 or auth error
            set({
              user: null,
              isLoading: false,
              isInitialized: true,
            })
          }
        } catch {
          set({
            user: null,
            isLoading: false,
            isInitialized: true,
          })
        }
      },

      /**
       * Reset state (for testing)
       */
      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist refreshToken (user info is fetched from API)
      partialize: (state) => ({
        refreshToken: state.refreshToken
      }),
    }
  )
)

// Selectors (for performance optimization)
export const selectUser = (state: AuthState) => state.user
export const selectIsAuthenticated = (state: AuthState) => !!state.user
export const selectIsLoading = (state: AuthState) => state.isLoading
export const selectIsInitialized = (state: AuthState) => state.isInitialized
