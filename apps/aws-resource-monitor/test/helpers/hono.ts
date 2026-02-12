/**
 * Hono Test Utilities
 * --------------------------------
 * テスト用のHonoアプリケーション作成ヘルパー
 */
import { Hono } from 'hono'
import type { Context, Handler, MiddlewareHandler } from 'hono'

type HonoApp = Hono<any, any, any>

/**
 * テスト用のHonoアプリを作成
 */
export function createTestApp(): HonoApp {
  return new Hono()
}

/**
 * ミドルウェアをテストするためのアプリを作成
 */
export function createMiddlewareTestApp(
  middleware: MiddlewareHandler,
  handler: Handler = (c) => c.json({ success: true })
): HonoApp {
  const app = new Hono()
  app.use('*', middleware)
  app.get('/test', handler)
  app.post('/test', handler)
  app.get('/api/test', handler)
  app.post('/api/test', handler)
  return app
}

/**
 * ルートをテストするためのアプリを作成
 */
export function createRouteTestApp(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  handler: Handler
): HonoApp {
  const app = new Hono()
  app[method](path, handler)
  return app
}

/**
 * 複数のルートをテストするためのアプリを作成
 */
export function createRoutesTestApp(
  routes: Array<{ method: 'get' | 'post' | 'put' | 'delete'; path: string; handler: Handler }>
): HonoApp {
  const app = new Hono()
  for (const { method, path, handler } of routes) {
    app[method](path, handler)
  }
  return app
}

/**
 * レスポンスからJSONを取得
 */
export async function getJsonResponse<T = any>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}

/**
 * 成功レスポンスの検証
 */
export async function expectSuccessResponse(res: Response, expectedStatus = 200) {
  expect(res.status).toBe(expectedStatus)
  const json = await res.json()
  expect(json.success).toBe(true)
  return json
}
