/**
 * K8s Page Routes
 *
 * GET /k8s - K8sダッシュボード
 */

import { Hono } from 'hono'
import type { K8sPageServices } from '../../controllers/k8s/page.js'
import { createK8sDashboardController } from '../../controllers/k8s/page.js'

export function createK8sPageRoutes(services: K8sPageServices) {
  const app = new Hono()

  // Dashboard
  app.get('/', createK8sDashboardController(services))

  return app
}
