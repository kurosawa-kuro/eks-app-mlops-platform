/**
 * 共通エラー定義
 *
 * アプリケーション全体で使用するエラークラスとファクトリー
 * レイヤーに依存しない共通ユーティリティ
 */

/**
 * アプリケーションエラー（カスタムエラーコード付き）
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * よく使うエラーファクトリー
 */
export const Errors = {
  notFound: (resource = 'Resource') => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  badRequest: (message: string) => new AppError(message, 400, 'BAD_REQUEST'),
  unauthorized: (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN'),
  conflict: (message: string) => new AppError(message, 409, 'CONFLICT'),
  internal: (message = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR'),
  dbNotConfigured: () => new AppError('Database not configured', 500, 'DB_NOT_CONFIGURED'),
  dbUnavailable: (context?: string, cause?: unknown) =>
    new AppError(
      context ? `Database unavailable: ${context}` : 'Database unavailable',
      503,
      'DB_UNAVAILABLE',
      cause
    ),
  serviceUnavailable: (service: string, cause?: unknown) =>
    new AppError(`Service unavailable: ${service}`, 503, 'SERVICE_UNAVAILABLE', cause),
} as const

/**
 * エラーレスポンスの型
 */
export interface ErrorResponse {
  error: string
  status: number
  code?: string
  requestId?: string
  timestamp: string
  path?: string
  details?: unknown
}
