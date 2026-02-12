import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

/**
 * 公開API用 CORS（/api/info, /api/health）
 *
 * - origin: * （どこからでもアクセス可）
 * - credentials: false（Cookie/認証不要）
 *
 * ブラウザからの fetch / axios で安全に叩ける設定
 */
export const publicCorsMiddleware: MiddlewareHandler = cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: false,
  maxAge: 86400
})

/**
 * 認証API用 CORS（/settings/api, /dashboard/samples/api 等）
 *
 * 重要: `Access-Control-Allow-Origin: *` と `credentials: true` の組み合わせは
 * ブラウザ仕様上無効です。credentials を使う場合は具体的な origin を返す必要があります。
 *
 * - 開発時: リクエスト元の origin をエコーバック（credentials 有効）
 * - 本番時: CORS_ORIGINS で許可した origin のみエコーバック
 */
export const protectedCorsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    // origin なし（curl, サーバー間通信）でも origin を返す必要がある
    // credentials: true の場合、* は使えないので開発用にlocalhost想定
    if (!origin) {
      return process.env.APP_ENV !== 'production' ? 'http://localhost:3000' : null
    }

    // 開発時: リクエスト元 origin をエコーバック
    if (process.env.APP_ENV !== 'production') {
      return origin
    }

    // 本番時: CORS_ORIGINS に含まれる origin のみ許可
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || []
    return allowedOrigins.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['X-Request-Id'],
  credentials: true,
  maxAge: 86400
})
