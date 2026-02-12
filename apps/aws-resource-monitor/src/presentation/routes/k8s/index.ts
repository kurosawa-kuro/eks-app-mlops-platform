/**
 * K8s Routes Index - Minimal Mode
 * Aggregates K8s API routes and Page routes
 */

import { Hono } from 'hono'
import { createK8sApiRoutes } from './api.js'
import { createK8sPageRoutes } from './page.js'
import type { K8sMinimalService } from '../../../infra/k8s/k8sService.js'

interface K8sRoutesDeps {
  k8sService: K8sMinimalService | null
}

export function createK8sRoutes(deps: K8sRoutesDeps) {
  const app = new Hono()

  // Mount API routes (only if service is available)
  if (deps.k8sService) {
    app.route('/api/k8s', createK8sApiRoutes({
      k8sService: deps.k8sService,
    }))
  }

  // Mount Page routes (always available - shows disabled message if not enabled)
  app.route('/k8s', createK8sPageRoutes(deps))

  return app
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Original routes with Prometheus support
 * ============================================================================

import type { K8sService } from '../../../infra/k8s/k8sService.js'
import type { PrometheusService } from '../../../infra/k8s/prometheusService.js'

interface K8sRoutesDeps {
  k8sService: K8sService | null
  prometheusService: PrometheusService | null
}

export function createK8sRoutes(deps: K8sRoutesDeps) {
  const app = new Hono()

  // Mount API routes (only if services are available)
  if (deps.k8sService && deps.prometheusService) {
    app.route('/api/k8s', createK8sApiRoutes({
      k8sService: deps.k8sService,
      prometheusService: deps.prometheusService,
    }))
  }

  // Mount Page routes (always available - shows disabled message if not enabled)
  app.route('/k8s', createK8sPageRoutes(deps))

  return app
}

============================================================================ */
