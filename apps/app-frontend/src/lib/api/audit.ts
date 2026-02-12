import { api } from './fetcher'
import type { ApiResponse } from '@/types/api'
import type { AuditLog, AuditLogFilter } from '@/types/shop'

/**
 * Audit API Client
 * Admin only endpoints
 */
export const auditApi = {
  /**
   * Get audit logs with optional filtering
   */
  getLogs: async (filter?: AuditLogFilter): Promise<ApiResponse<AuditLog[]>> => {
    const params = new URLSearchParams()
    if (filter?.userId) params.set('userId', filter.userId)
    if (filter?.action) params.set('action', filter.action)
    if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
    if (filter?.dateTo) params.set('dateTo', filter.dateTo)

    const queryString = params.toString()
    const endpoint = queryString ? `/api/audit?${queryString}` : '/api/audit'

    return api.get<AuditLog[]>(endpoint)
  },

  /**
   * Get distinct actions for filter dropdown
   */
  getActions: async (): Promise<ApiResponse<string[]>> => {
    return api.get<string[]>('/api/audit/actions')
  },
}
