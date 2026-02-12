/**
 * Health status of the application
 */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  db?: {
    connected: boolean
    status: 'ok' | 'error'
  }
}

/**
 * Result of database connection tests
 */
export interface ConnectionResult {
  success: boolean
  message: string
}

/**
 * Metrics data for monitoring
 */
export interface MetricsData {
  httpRequestsTotal: number
  httpErrorsTotal: number
}
