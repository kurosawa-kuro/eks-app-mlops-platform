/**
 * AWS Routes
 *
 * ページルートとAPIルートを統合
 */

import { Hono } from 'hono'
import type { RouteContext } from '../types.js'
import { createAWSApiRoutes } from './api.js'
import { createAWSPageRoutes } from './page.js'

export function createAWSRoutes(ctx: RouteContext) {
  const app = new Hono()
  const { container } = ctx

  // Resolve services from container
  const resourceService = container.resolve('resourceService')
  const costService = container.resolve('costService')
  const eksSystemlogService = container.resolve('eksSystemlogService')

  // API Routes
  app.route('/api', createAWSApiRoutes({
    resourceService,
    costService,
    eksSystemlogService,
  }))

  // Page Routes (pass all services for page rendering)
  app.route('/', createAWSPageRoutes({
    resourceService,
    costService,
    eksSystemlogService,
  }))

  return app
}
