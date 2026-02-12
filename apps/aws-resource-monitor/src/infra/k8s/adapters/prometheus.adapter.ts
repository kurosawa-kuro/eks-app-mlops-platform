/**
 * Prometheus Adapter - DISABLED FOR MINIMAL MODE
 * HTTP client for Prometheus API
 *
 * This file is disabled in minimal mode.
 * To re-enable, uncomment the code below and restore types in types.ts
 */

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * ============================================================================

import type {
  IPrometheusAdapter,
  PrometheusResponse,
  PrometheusVectorResult,
  PrometheusMatrixResult,
} from './types.js'

export class PrometheusAdapter implements IPrometheusAdapter {
  private baseUrl: string

  constructor(baseUrl: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  // ============================================================================
  // Instant Query
  // ============================================================================

  async query(promql: string): Promise<PrometheusResponse<PrometheusVectorResult>> {
    const url = `${this.baseUrl}/api/v1/query`
    const params = new URLSearchParams({ query: promql })

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        status: 'error',
        data: { resultType: 'vector', result: [] },
        errorType: 'http_error',
        error: `HTTP ${response.status}: ${error}`,
      }
    }

    const data = await response.json() as PrometheusResponse<PrometheusVectorResult>
    return data
  }

  // ============================================================================
  // Range Query
  // ============================================================================

  async queryRange(
    promql: string,
    start: Date,
    end: Date,
    step: string
  ): Promise<PrometheusResponse<PrometheusMatrixResult>> {
    const url = `${this.baseUrl}/api/v1/query_range`
    const params = new URLSearchParams({
      query: promql,
      start: (start.getTime() / 1000).toString(),
      end: (end.getTime() / 1000).toString(),
      step,
    })

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        status: 'error',
        data: { resultType: 'matrix', result: [] },
        errorType: 'http_error',
        error: `HTTP ${response.status}: ${error}`,
      }
    }

    const data = await response.json() as PrometheusResponse<PrometheusMatrixResult>
    return data
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async isHealthy(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/-/healthy`
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

============================================================================ */
