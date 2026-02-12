/**
 * Health & Info API Routes
 * Common diagnostic endpoints for monitoring and service discovery
 */
import { Hono } from 'hono'
import type { RouteContext } from '../types.js'
import { publicCorsMiddleware } from '../../middleware/cors.js'

export function createHealthRoutes(ctx: RouteContext) {
  const app = new Hono()
  const { appConfig } = ctx

  // Apply public CORS (allow all origins, no credentials)
  app.use('*', publicCorsMiddleware)

  // Health check - for load balancers and monitoring
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  )

  // Service info - for service discovery
  app.get('/info', (c) =>
    c.json({
      name: appConfig.projectName,
      version: '1.0.0',
      environment: appConfig.appEnv
    })
  )

  return app
}
