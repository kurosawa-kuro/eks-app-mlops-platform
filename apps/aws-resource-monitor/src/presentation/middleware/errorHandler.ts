import type { ErrorHandler, Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from '../../shared/logger.js'
import { AppError, type ErrorResponse } from '../../shared/errors.js'

/**
 * APIリクエストかどうかを判定
 */
function isApiRequest(c: Context): boolean {
  const path = c.req.path
  const accept = c.req.header('Accept') || ''

  return (
    path.includes('/api') ||
    accept.includes('application/json') ||
    c.req.header('X-Requested-With') === 'XMLHttpRequest'
  )
}

/**
 * 本番環境かどうかを判定
 */
function isProduction(): boolean {
  return process.env.APP_ENV === 'production'
}

/**
 * エラーからステータスコードを取得
 */
function getStatusCode(err: Error): number {
  if (err instanceof AppError) return err.status
  if (err instanceof HTTPException) return err.status
  if ('status' in err && typeof err.status === 'number') return err.status
  if ('statusCode' in err && typeof err.statusCode === 'number') return err.statusCode
  return 500
}

/**
 * エラーからエラーコードを取得
 */
function getErrorCode(err: Error): string | undefined {
  if (err instanceof AppError) return err.code
  return undefined
}

/**
 * 強化版エラーハンドラー
 *
 * - API/ページリクエストを区別してレスポンス形式を変更
 * - リクエストIDをレスポンスに含める
 * - 本番環境では詳細エラーを隠蔽
 * - AppErrorによるカスタムエラーコードをサポート
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const status = getStatusCode(err)
  const code = getErrorCode(err)
  const requestId = c.get('requestId') as string | undefined
  const path = c.req.path
  const method = c.req.method

  // ロギング（5xxエラーはerror、それ以外はwarn）
  const logData = {
    err,
    cause: err instanceof AppError ? err.cause : undefined,
    path,
    method,
    status,
    code,
    requestId
  }

  if (status >= 500) {
    logger.error(logData, 'Server error')
  } else {
    logger.warn(logData, 'Client error')
  }

  // 本番環境では予期しない500エラーの詳細を隠す（AppErrorは意図的なエラーなので表示）
  const message =
    status >= 500 && isProduction() && !(err instanceof AppError) ? 'Internal server error' : err.message

  // APIリクエストにはJSONレスポンス
  if (isApiRequest(c)) {
    const response: ErrorResponse = {
      error: message,
      status,
      timestamp: new Date().toISOString()
    }

    if (code) response.code = code
    if (requestId) response.requestId = requestId
    if (!isProduction()) response.path = path

    return c.json(response, status as 400 | 401 | 403 | 404 | 409 | 500)
  }

  // ページリクエストにはHTMLエラーページ
  const errorHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error ${status}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .error-container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; }
    h1 { color: #e53e3e; margin: 0 0 1rem; }
    p { color: #666; margin: 0 0 1rem; }
    .code { font-family: monospace; background: #f0f0f0; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.9rem; }
    a { color: #3182ce; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Error ${status}</h1>
    <p>${message}</p>
    ${requestId ? `<p class="code">Request ID: ${requestId}</p>` : ''}
    <p><a href="/">Return to Home</a></p>
  </div>
</body>
</html>
`

  return c.html(errorHtml, status as 400 | 401 | 403 | 404 | 409 | 500)
}
