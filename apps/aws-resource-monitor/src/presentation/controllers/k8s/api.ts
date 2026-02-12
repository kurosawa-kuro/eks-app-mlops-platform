/**
 * K8s API Controllers - Minimal Mode
 * Pod phase status only
 */

import type { Context } from 'hono'
import type { K8sMinimalService, K8sMinimalStatus } from '../../../infra/k8s/k8sService.js'

// ============================================================================
// Minimal Mode Controllers
// ============================================================================

function toStatusResponse(status: K8sMinimalStatus) {
  return {
    status: status.status,
    namespaces: status.namespaces.map((ns) => ({
      namespace: ns.namespace,
      allRunning: ns.allRunning,
      error: ns.error,
      pods: ns.pods.map((p) => ({
        name: p.name,
        phase: p.phase,
        rawPhase: p.rawPhase,
      })),
    })),
    karpenter: status.karpenter,
    gpuNodes: status.gpuNodes,
    llm: status.llm,
    lastUpdated: status.lastUpdated.toISOString(),
  }
}

export function createStatusController(k8sService: K8sMinimalService) {
  return async (c: Context) => {
    const forceRefresh = c.req.query('refresh') === 'true'
    const status = await k8sService.getStatus(forceRefresh)

    return c.json({
      success: true,
      data: toStatusResponse(status),
    })
  }
}

export function createNamespacesController(k8sService: K8sMinimalService) {
  return async (c: Context) => {
    const namespaces = k8sService.getMonitoredNamespaces()

    return c.json({
      success: true,
      data: {
        namespaces,
        count: namespaces.length,
      },
    })
  }
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Original controllers with Node/Job/Alert/Prometheus support
 * ============================================================================

import type { Context } from 'hono'
import type { K8sService } from '../../../infra/k8s/k8sService.js'
import type { PrometheusService } from '../../../infra/k8s/prometheusService.js'
import type { K8sNode, K8sPod, K8sJob, K8sAlert } from '../../../domain/entities/k8s.js'
import { Errors } from '../../../shared/errors.js'

// ============================================================================
// Response Mappers
// ============================================================================

function toNodeResponse(node: K8sNode) {
  return {
    ...node,
    createdAt: node.createdAt.toISOString(),
    conditions: node.conditions.map((c) => ({
      ...c,
      lastTransitionTime: c.lastTransitionTime?.toISOString() ?? null,
    })),
  }
}

function toPodResponse(pod: K8sPod) {
  return {
    ...pod,
    createdAt: pod.createdAt.toISOString(),
  }
}

function toJobResponse(job: K8sJob) {
  return {
    ...job,
    startTime: job.startTime?.toISOString() ?? null,
    completionTime: job.completionTime?.toISOString() ?? null,
    conditions: job.conditions.map((c) => ({
      ...c,
      lastTransitionTime: c.lastTransitionTime?.toISOString() ?? null,
    })),
  }
}

function toAlertResponse(alert: K8sAlert) {
  return {
    ...alert,
    detectedAt: alert.detectedAt.toISOString(),
  }
}

// ============================================================================
// Node Controllers
// ============================================================================

export function createNodesListController(k8sService: K8sService) {
  return async (c: Context) => {
    const forceRefresh = c.req.query('refresh') === 'true'
    const nodes = await k8sService.getNodes(forceRefresh)

    return c.json({
      success: true,
      data: {
        nodes: nodes.map(toNodeResponse),
        count: nodes.length,
        summary: {
          ready: nodes.filter((n) => n.status === 'Ready').length,
          notReady: nodes.filter((n) => n.status !== 'Ready').length,
        },
      },
    })
  }
}

export function createNodeDetailController(k8sService: K8sService) {
  return async (c: Context) => {
    const name = c.req.param('name')

    if (!name) {
      throw Errors.badRequest('name parameter is required')
    }

    const node = await k8sService.getNodeDetails(name)

    if (!node) {
      throw Errors.notFound(`Node ${name}`)
    }

    return c.json({
      success: true,
      data: toNodeResponse(node),
    })
  }
}

// ============================================================================
// Pod Controllers
// ============================================================================

export function createPodsListController(k8sService: K8sService) {
  return async (c: Context) => {
    const namespace = c.req.query('namespace')
    const forceRefresh = c.req.query('refresh') === 'true'

    const pods = await k8sService.getPods(namespace || undefined, forceRefresh)

    // Calculate alerts inline
    const restartingPods = pods.filter((p) => p.restartCount >= 3)
    const failedPods = pods.filter((p) => p.phase === 'Failed')

    return c.json({
      success: true,
      data: {
        pods: pods.map(toPodResponse),
        count: pods.length,
        summary: {
          running: pods.filter((p) => p.phase === 'Running').length,
          pending: pods.filter((p) => p.phase === 'Pending').length,
          succeeded: pods.filter((p) => p.phase === 'Succeeded').length,
          failed: failedPods.length,
          restarting: restartingPods.length,
        },
      },
    })
  }
}

export function createPodDetailController(k8sService: K8sService) {
  return async (c: Context) => {
    const namespace = c.req.param('namespace')
    const name = c.req.param('name')

    if (!namespace || !name) {
      throw Errors.badRequest('namespace and name parameters are required')
    }

    const pod = await k8sService.getPodDetails(namespace, name)

    if (!pod) {
      throw Errors.notFound(`Pod ${namespace}/${name}`)
    }

    return c.json({
      success: true,
      data: toPodResponse(pod),
    })
  }
}

// ============================================================================
// Job Controllers
// ============================================================================

export function createJobsListController(k8sService: K8sService) {
  return async (c: Context) => {
    const namespace = c.req.query('namespace')
    const status = c.req.query('status')
    const forceRefresh = c.req.query('refresh') === 'true'

    let jobs = await k8sService.getJobs(namespace || undefined, forceRefresh)

    // Filter by status if specified
    if (status) {
      const validStatuses = ['Active', 'Succeeded', 'Failed', 'Suspended']
      if (!validStatuses.includes(status)) {
        throw Errors.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
      }
      jobs = jobs.filter((j) => j.status === status)
    }

    return c.json({
      success: true,
      data: {
        jobs: jobs.map(toJobResponse),
        count: jobs.length,
        summary: {
          active: jobs.filter((j) => j.status === 'Active').length,
          succeeded: jobs.filter((j) => j.status === 'Succeeded').length,
          failed: jobs.filter((j) => j.status === 'Failed').length,
          suspended: jobs.filter((j) => j.status === 'Suspended').length,
        },
      },
    })
  }
}

export function createJobDetailController(k8sService: K8sService) {
  return async (c: Context) => {
    const namespace = c.req.param('namespace')
    const name = c.req.param('name')

    if (!namespace || !name) {
      throw Errors.badRequest('namespace and name parameters are required')
    }

    const job = await k8sService.getJobDetails(namespace, name)

    if (!job) {
      throw Errors.notFound(`Job ${namespace}/${name}`)
    }

    return c.json({
      success: true,
      data: toJobResponse(job),
    })
  }
}

// ============================================================================
// Namespace Controllers
// ============================================================================

export function createNamespacesListController(k8sService: K8sService) {
  return async (c: Context) => {
    const namespaces = await k8sService.getNamespaces()

    return c.json({
      success: true,
      data: {
        namespaces,
        count: namespaces.length,
      },
    })
  }
}

// ============================================================================
// Alert Controllers
// ============================================================================

export function createAlertsController(k8sService: K8sService) {
  return async (c: Context) => {
    const alerts = await k8sService.detectAlerts()

    return c.json({
      success: true,
      data: {
        alerts: alerts.map(toAlertResponse),
        count: alerts.length,
        summary: {
          critical: alerts.filter((a) => a.severity === 'critical').length,
          warning: alerts.filter((a) => a.severity === 'warning').length,
        },
      },
    })
  }
}

// ============================================================================
// Stats Controllers
// ============================================================================

export function createStatsController(k8sService: K8sService) {
  return async (c: Context) => {
    const stats = await k8sService.getStats()

    return c.json({
      success: true,
      data: {
        ...stats,
        lastUpdated: stats.lastUpdated.toISOString(),
      },
    })
  }
}

// ============================================================================
// Prometheus Metrics Controllers
// ============================================================================

export function createMetricsSummaryController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const summary = await prometheusService.getSummary()

    return c.json({
      success: true,
      data: {
        ...summary,
        timestamp: summary.timestamp.toISOString(),
      },
    })
  }
}

export function createCpuMetricsController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const target = c.req.query('target')
    const metrics = await prometheusService.getCpuUsage(target || undefined)

    return c.json({
      success: true,
      data: {
        metrics: metrics.map((m) => ({
          ...m,
          value: m.value
            ? {
                timestamp: m.value.timestamp.toISOString(),
                value: m.value.value,
              }
            : null,
        })),
        count: metrics.length,
      },
    })
  }
}

export function createMemoryMetricsController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const target = c.req.query('target')
    const metrics = await prometheusService.getMemoryUsage(target || undefined)

    return c.json({
      success: true,
      data: {
        metrics: metrics.map((m) => ({
          ...m,
          value: m.value
            ? {
                timestamp: m.value.timestamp.toISOString(),
                value: m.value.value,
              }
            : null,
        })),
        count: metrics.length,
      },
    })
  }
}

export function createGpuMetricsController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const metrics = await prometheusService.getGpuUsage()

    return c.json({
      success: true,
      data: {
        metrics: metrics.map((m) => ({
          ...m,
          value: m.value
            ? {
                timestamp: m.value.timestamp.toISOString(),
                value: m.value.value,
              }
            : null,
        })),
        count: metrics.length,
        available: metrics.length > 0,
      },
    })
  }
}

export function createPromqlQueryController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const body = await c.req.json<{ query?: string }>()

    if (!body.query) {
      throw Errors.badRequest('query field is required in request body')
    }

    const result = await prometheusService.executeQuery(body.query)

    return c.json({
      success: true,
      data: result,
    })
  }
}

export function createPrometheusHealthController(prometheusService: PrometheusService) {
  return async (c: Context) => {
    const healthy = await prometheusService.isHealthy()

    return c.json({
      success: true,
      data: {
        healthy,
        timestamp: new Date().toISOString(),
      },
    })
  }
}

============================================================================ */
