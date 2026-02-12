import type { MiddlewareHandler } from 'hono'
import { logger } from '../../shared/logger.js'
import { generateRequestId } from '../../shared/requestId.js'

/**
 * リクエストロガーミドルウェア
 *
 * - リクエストIDを生成してコンテキストに設定
 * - レスポンスヘッダーにX-Request-Idを追加
 * - リクエスト完了時にログ出力
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || generateRequestId()
  c.set('requestId', requestId)

  const start = Date.now()

  await next()

  // レスポンスヘッダーにリクエストIDを追加
  c.header('X-Request-Id', requestId)

  const duration = Date.now() - start
  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: `${duration}ms`
    },
    'Request completed'
  )
}
