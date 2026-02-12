/**
 * K8s Page Controllers - Minimal Mode
 * Pod phase status dashboard only
 */

import type { Context } from 'hono'
import type { K8sMinimalService } from '../../../infra/k8s/k8sService.js'
import { render } from '../../helpers/render.js'

// ============================================================================
// Service Dependencies Interface
// ============================================================================

export interface K8sPageServices {
  k8sService: K8sMinimalService | null
}

// ============================================================================
// Dashboard Page - Minimal Mode
// ============================================================================

export function createK8sDashboardController(services: K8sPageServices) {
  const { k8sService } = services

  return async (c: Context) => {
    // Check if K8s is enabled
    if (!k8sService) {
      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: false,
        status: null,
      })
    }

    // Force refresh if requested
    const forceRefresh = c.req.query('refresh') === '1'

    try {
      const status = await k8sService.getStatus(forceRefresh)

      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: true,
        status,
      })
    } catch (error) {
      console.error('K8s Dashboard error:', error)

      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: true,
        status: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Original controller with full Node/Job/Alert support
 * ============================================================================

import type { Context } from 'hono'
import type { K8sService } from '../../../infra/k8s/k8sService.js'
import type { PrometheusService } from '../../../infra/k8s/prometheusService.js'
import { render } from '../../helpers/render.js'

export interface K8sPageServices {
  k8sService: K8sService | null
  prometheusService: PrometheusService | null
}

export function createK8sDashboardController(services: K8sPageServices) {
  const { k8sService } = services

  return async (c: Context) => {
    // Check if K8s is enabled
    if (!k8sService) {
      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: false,
        stats: { nodes: { total: 0, ready: 0, notReady: 0 }, pods: { total: 0, running: 0, pending: 0, failed: 0 }, jobs: { total: 0, active: 0, succeeded: 0, failed: 0 }, alerts: { total: 0, critical: 0, warning: 0 } },
        nodes: [],
        pods: [],
        jobs: [],
        alerts: [],
      })
    }

    // Force refresh if requested
    const forceRefresh = c.req.query('refresh') === '1'

    try {
      // Fetch all data in parallel
      const [stats, nodes, pods, jobs, alerts] = await Promise.all([
        k8sService.getStats(),
        k8sService.getNodes(forceRefresh),
        k8sService.getPods(undefined, forceRefresh),
        k8sService.getJobs(undefined, forceRefresh),
        k8sService.detectAlerts(),
      ])

      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: true,
        stats,
        nodes,
        pods,
        jobs,
        alerts,
      })
    } catch (error) {
      console.error('K8s Dashboard error:', error)

      // Return error state
      return render(c, 'k8s/dashboard', {
        layout: 'aws-main',
        title: 'K8s Monitoring',
        pageTitle: 'Kubernetes Monitoring',
        activePage: 'k8s',
        k8sEnabled: true,
        stats: { nodes: { total: 0, ready: 0, notReady: 0 }, pods: { total: 0, running: 0, pending: 0, failed: 0 }, jobs: { total: 0, active: 0, succeeded: 0, failed: 0 }, alerts: { total: 0, critical: 0, warning: 0 } },
        nodes: [],
        pods: [],
        jobs: [],
        alerts: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

============================================================================ */
