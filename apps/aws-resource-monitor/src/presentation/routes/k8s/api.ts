/**
 * K8s API Routes - Minimal Mode
 *
 * GET  /api/k8s/status     - Pod phase status for monitored namespaces
 * GET  /api/k8s/namespaces - Monitored namespaces list
 */

import { Hono } from 'hono'
import type { K8sMinimalService } from '../../../infra/k8s/k8sService.js'
import {
  createStatusController,
  createNamespacesController,
} from '../../controllers/k8s/api.js'

interface K8sApiDeps {
  k8sService: K8sMinimalService
}

export function createK8sApiRoutes(deps: K8sApiDeps) {
  const app = new Hono()
  const { k8sService } = deps

  // Minimal Mode Endpoints
  app.get('/status', createStatusController(k8sService))
  app.get('/namespaces', createNamespacesController(k8sService))

  return app
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Original routes with Node/Job/Prometheus/Alert support
 * ============================================================================

import { Hono } from 'hono'
import type { K8sService } from '../../../infra/k8s/k8sService.js'
import type { PrometheusService } from '../../../infra/k8s/prometheusService.js'
import {
  createNodesListController,
  createNodeDetailController,
  createPodsListController,
  createPodDetailController,
  createJobsListController,
  createJobDetailController,
  createNamespacesListController,
  createAlertsController,
  createStatsController,
  createMetricsSummaryController,
  createCpuMetricsController,
  createMemoryMetricsController,
  createGpuMetricsController,
  createPromqlQueryController,
  createPrometheusHealthController,
} from '../../controllers/k8s/api.js'

interface K8sApiDeps {
  k8sService: K8sService
  prometheusService: PrometheusService
}

export function createK8sApiRoutes(deps: K8sApiDeps) {
  const app = new Hono()
  const { k8sService, prometheusService } = deps

  // Nodes
  app.get('/nodes', createNodesListController(k8sService))
  app.get('/nodes/:name', createNodeDetailController(k8sService))

  // Pods
  app.get('/pods', createPodsListController(k8sService))
  app.get('/pods/:namespace/:name', createPodDetailController(k8sService))

  // Jobs (MLOps)
  app.get('/jobs', createJobsListController(k8sService))
  app.get('/jobs/:namespace/:name', createJobDetailController(k8sService))

  // Namespaces
  app.get('/namespaces', createNamespacesListController(k8sService))

  // Alerts
  app.get('/alerts', createAlertsController(k8sService))

  // Stats
  app.get('/stats', createStatsController(k8sService))

  // Prometheus Metrics
  app.get('/metrics/summary', createMetricsSummaryController(prometheusService))
  app.get('/metrics/cpu', createCpuMetricsController(prometheusService))
  app.get('/metrics/memory', createMemoryMetricsController(prometheusService))
  app.get('/metrics/gpu', createGpuMetricsController(prometheusService))
  app.post('/metrics/query', createPromqlQueryController(prometheusService))
  app.get('/metrics/health', createPrometheusHealthController(prometheusService))

  return app
}

============================================================================ */
