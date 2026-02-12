import type { ApiResponse } from '@/types/api'

// Use empty string for same-origin requests (via Next.js rewrites proxy)
// This ensures cookies work correctly in development (cross-origin cookie issues)
const API_BASE = ''

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  skipCredentials?: boolean
}

/**
 * API fetch wrapper
 * - credentials: 'include' by default (for Cookie transmission)
 * - Returns status on error (for 401 auth guard check)
 */
export async function fetcher<T>(
  endpoint: string,
  options: FetchOptions & { body?: unknown } = {}
): Promise<ApiResponse<T>> {
  const { skipCredentials = false, body, ...fetchOptions } = options
  const url = `${API_BASE}${endpoint}`

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      credentials: skipCredentials ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    // Handle non-JSON responses
    const contentType = res.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: `Unexpected content type: ${contentType}`,
        status: res.status,
      }
    }

    const data = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${res.status}`,
        status: res.status,
      }
    }

    return data
  } catch (error) {
    // Network error / JSON parse error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    }
  }
}

/**
 * Convenience functions
 */
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetcher<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetcher<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetcher<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetcher<T>(endpoint, { ...options, method: 'DELETE' }),
}
