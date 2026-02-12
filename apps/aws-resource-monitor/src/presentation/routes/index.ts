import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AwilixContainer } from 'awilix'
import type { Cradle } from '../../di/container.js'
import type { AppConfig } from '../../env/index.js'
import type { RouteContext } from './types.js'
import { errorHandler } from '../middleware/errorHandler.js'
import { requestLogger } from '../middleware/requestLogger.js'
import { rateLimiterMiddleware } from '../middleware/rateLimiter.js'

// API routes
import { createHealthRoutes } from './api/health.js'

// AWS Resource Monitor routes
import { createAWSRoutes } from './aws/index.js'

// K8s Monitoring routes
import { createK8sRoutes } from './k8s/index.js'

export function createRoutes(container: AwilixContainer<Cradle>, appConfig: AppConfig) {
  const app = new Hono()

  // Global middleware
  app.use('*', rateLimiterMiddleware)
  app.use('*', requestLogger)
  app.onError(errorHandler)

  // Route context（依存はcontainerから解決）
  const ctx: RouteContext = {
    container,
    appConfig,
  }

  // Static file serving for uploaded images
  const prodStaticRoot = path.join(process.cwd(), 'dist', 'presentation', 'public')
  const staticRoot = fs.existsSync(prodStaticRoot)
    ? './dist/presentation/public'
    : './src/presentation/public'
  app.use('/uploads/*', serveStatic({ root: staticRoot }))
  app.get('/favicon.svg', serveStatic({ root: staticRoot, path: '/favicon.svg' }))

  // Root redirect to AWS dashboard (main feature)
  app.get('/', (c) => c.redirect('/aws'))

  // Legacy URL redirects (old-backend compatibility)
  app.get('/resources', (c) => {
    const query = c.req.url.split('?')[1]
    return c.redirect(query ? `/aws/resources?${query}` : '/aws/resources')
  })
  app.get('/costs', (c) => c.redirect('/aws/costs'))
  app.get('/eks', (c) => c.redirect('/aws/eks'))
  app.get('/eks/*', (c) => c.redirect(`/aws${c.req.path}`))
  app.get('/alerts/high-cost', (c) => c.redirect('/aws/alerts/high-cost'))

  // API routes (common endpoints)
  app.route('/api', createHealthRoutes(ctx))

  // AWS Resource Monitor (no auth required - local only)
  app.route('/aws', createAWSRoutes(ctx))

  // K8s Monitoring - Minimal Mode (page always available, API enabled by K8S_ENABLED)
  const k8sService = container.resolve('k8sService')
  app.route('/', createK8sRoutes({ k8sService }))

  return app
}
