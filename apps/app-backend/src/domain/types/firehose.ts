/**
 * Audit Log record structure for Firehose delivery
 *
 * This unified log format supports:
 * - Access logging (all requests)
 * - Audit logging (user actions with identification)
 *
 * Can be sent to: Firehose → S3 for analysis
 */
export interface FirehoseLogRecord {
  // Required fields
  timestamp: string
  method: string
  path: string
  statusCode: number
  durationMs: number

  // Client identification
  userAgent?: string
  ip?: string
  requestId?: string

  // User identification (Audit)
  userId?: string
  userEmail?: string
  userRole?: string

  // Additional audit context
  action?: string // e.g., 'login', 'logout', 'create', 'delete'
  resource?: string // e.g., 'user', 'analytics', 'settings'
  resourceId?: string // ID of the affected resource
}

/**
 * Result of Firehose send operation
 */
export interface FirehoseSendResult {
  success: boolean
  recordId?: string
  errorCode?: string
  errorMessage?: string
}
