/**
 * Prometheus Service - DISABLED FOR MINIMAL MODE
 * Provides Prometheus metrics querying functionality
 *
 * This file is disabled in minimal mode.
 * To re-enable, uncomment the code below and restore types in adapters/types.ts
 */

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * ============================================================================

import type { IPrometheusAdapter } from './adapters/types.js'
import type { CacheService } from '../cache/memoryCache.js'
import type {
  MetricResult,
  ClusterMetricsSummary,
  PrometheusQueryResult,
} from '../../domain/entities/k8s.js'

const CACHE_PREFIX = 'prometheus:'

// Pre-defined PromQL queries
const QUERIES = {
  // CPU usage by pod (cores)
  cpuUsageByPod: 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod, namespace)',
  // Memory usage by pod (bytes)
  memoryUsageByPod: 'sum(container_memory_usage_bytes{container!=""}) by (pod, namespace)',
  // CPU usage by node (cores)
  cpuUsageByNode: 'sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance)',
  // Memory usage by node (bytes)
  memoryUsageByNode: 'node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes',
  // GPU utilization (NVIDIA DCGM)
  gpuUtilization: 'DCGM_FI_DEV_GPU_UTIL',
  // GPU memory used (bytes)
  gpuMemoryUsed: 'DCGM_FI_DEV_FB_USED * 1024 * 1024',
  // Pod restart count
  podRestarts: 'sum(kube_pod_container_status_restarts_total) by (pod, namespace)',
  // OOM killed events
  oomKilled: 'sum(kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}) by (pod, namespace)',
  // Node count
  nodeCount: 'count(kube_node_info)',
  // Pod count
  podCount: 'count(kube_pod_info)',
}

export interface MetricSummary {
  avg: number
  max: number
  min: number
  count: number
}

export interface PrometheusService {
  // Basic metrics
  getCpuUsage(target?: string): Promise<MetricResult[]>
  getMemoryUsage(target?: string): Promise<MetricResult[]>

  // Node metrics
  getNodeCpuUsage(): Promise<MetricResult[]>
  getNodeMemoryUsage(): Promise<MetricResult[]>

  // GPU metrics (NVIDIA DCGM)
  getGpuUsage(): Promise<MetricResult[]>
  getGpuMemory(): Promise<MetricResult[]>

  // Restart/OOM metrics
  getPodRestarts(): Promise<MetricResult[]>
  getOOMKilledPods(): Promise<MetricResult[]>

  // Custom query
  executeQuery(promql: string): Promise<PrometheusQueryResult>

  // Summary (AI-friendly)
  getSummary(): Promise<ClusterMetricsSummary>

  // Health
  isHealthy(): Promise<boolean>
}

export function createPrometheusService(
  prometheusAdapter: IPrometheusAdapter,
  cache: CacheService,
  cacheTtlMs: number
): PrometheusService {
  // ... implementation ...
}

============================================================================ */
