/**
 * K8s Service - Minimal Mode
 * Pod phase monitoring only (Running/NotRunning)
 *
 * 監視対象: database, app, monitoring, karpenter-system, llm namespaces
 */

import type { IK8sAdapter, K8sPodInfo, K8sNodeInfo } from './adapters/types.js'
import type { CacheService } from '../cache/memoryCache.js'

const CACHE_PREFIX = 'k8s:'
const DEFAULT_MONITORED_NAMESPACES = ['database', 'app', 'monitoring', 'karpenter', 'llm']

// ============================================================================
// Minimal Mode Types
// ============================================================================

export interface PodPhaseInfo {
  name: string
  phase: 'Running' | 'NotRunning'
  rawPhase: string
}

export interface NamespacePodStatus {
  namespace: string
  pods: PodPhaseInfo[]
  allRunning: boolean
  error?: string
}

// ============================================================================
// Karpenter Status
// ============================================================================

export interface KarpenterStatus {
  running: number
  total: number
}

// ============================================================================
// GPU Node Status
// ============================================================================

export interface GpuNodeInfo {
  name: string
  instanceType: string
  capacityType: 'spot' | 'on-demand' | 'unknown'
  gpuCount: number
  ready: boolean
  creationTimestamp: Date
}

export interface GpuNodesStatus {
  nodes: GpuNodeInfo[]
  totalNodes: number
  totalGpus: number
}

// ============================================================================
// LLM Namespace Status
// ============================================================================

export interface LlmPodStatus {
  name: string
  ready: boolean
  type: 'embeddings' | 'inference' | 'other'
}

export interface LlmNamespaceStatus {
  pods: LlmPodStatus[]
  allRunning: boolean
}

// ============================================================================
// K8s Minimal Status (Extended)
// ============================================================================

export interface K8sMinimalStatus {
  status: 'OK' | 'NG'
  namespaces: NamespacePodStatus[]
  karpenter: KarpenterStatus | null
  gpuNodes: GpuNodesStatus | null
  llm: LlmNamespaceStatus | null
  lastUpdated: Date
}

// ============================================================================
// Minimal Service Interface
// ============================================================================

export interface K8sMinimalService {
  getStatus(forceRefresh?: boolean): Promise<K8sMinimalStatus>
  getMonitoredNamespaces(): string[]
}

// ============================================================================
// Minimal Service Factory
// ============================================================================

export function createK8sMinimalService(
  k8sAdapter: IK8sAdapter,
  cache: CacheService,
  cacheTtlMs: number,
  monitoredNamespaces?: string[]
): K8sMinimalService {
  const namespaces = monitoredNamespaces || DEFAULT_MONITORED_NAMESPACES

  function mapPhase(rawPhase: string): 'Running' | 'NotRunning' {
    return rawPhase === 'Running' ? 'Running' : 'NotRunning'
  }

  function mapToPodPhaseInfo(info: K8sPodInfo): PodPhaseInfo {
    return {
      name: info.name,
      phase: mapPhase(info.status.phase),
      rawPhase: info.status.phase,
    }
  }

  function extractKarpenterStatus(namespaceResults: NamespacePodStatus[]): KarpenterStatus | null {
    const karpenterNs = namespaceResults.find((ns) => ns.namespace === 'karpenter')
    if (!karpenterNs || karpenterNs.error) return null

    const running = karpenterNs.pods.filter((p) => p.phase === 'Running').length
    return {
      running,
      total: karpenterNs.pods.length,
    }
  }

  function extractLlmStatus(namespaceResults: NamespacePodStatus[]): LlmNamespaceStatus | null {
    const llmNs = namespaceResults.find((ns) => ns.namespace === 'llm')
    if (!llmNs || llmNs.error) return null

    const pods: LlmPodStatus[] = llmNs.pods.map((pod) => {
      let type: 'embeddings' | 'inference' | 'other' = 'other'
      if (pod.name.includes('embedding')) type = 'embeddings'
      else if (pod.name.includes('inference')) type = 'inference'

      return {
        name: pod.name,
        ready: pod.phase === 'Running',
        type,
      }
    })

    return {
      pods,
      allRunning: llmNs.allRunning,
    }
  }

  async function fetchGpuNodesStatus(): Promise<GpuNodesStatus | null> {
    try {
      const nodes = await k8sAdapter.listNodes()
      const gpuNodes = nodes.filter((n) => n.capacity['nvidia.com/gpu'])

      if (gpuNodes.length === 0) return null

      const gpuNodeInfos: GpuNodeInfo[] = gpuNodes.map((node) => {
        const instanceType = node.labels['node.kubernetes.io/instance-type'] || 'unknown'
        const capacityTypeLabel = node.labels['karpenter.sh/capacity-type'] || ''
        let capacityType: 'spot' | 'on-demand' | 'unknown' = 'unknown'
        if (capacityTypeLabel === 'spot') capacityType = 'spot'
        else if (capacityTypeLabel === 'on-demand') capacityType = 'on-demand'

        const readyCondition = node.conditions.find((c) => c.type === 'Ready')
        const ready = readyCondition?.status === 'True'

        return {
          name: node.name,
          instanceType,
          capacityType,
          gpuCount: parseInt(node.capacity['nvidia.com/gpu'] || '0', 10),
          ready,
          creationTimestamp: node.creationTimestamp,
        }
      })

      return {
        nodes: gpuNodeInfos,
        totalNodes: gpuNodeInfos.length,
        totalGpus: gpuNodeInfos.reduce((sum, n) => sum + n.gpuCount, 0),
      }
    } catch {
      return null
    }
  }

  return {
    getMonitoredNamespaces(): string[] {
      return namespaces
    },

    async getStatus(forceRefresh = false): Promise<K8sMinimalStatus> {
      const cacheKey = `${CACHE_PREFIX}minimal:status`

      if (!forceRefresh) {
        const cached = cache.get<K8sMinimalStatus>(cacheKey)
        if (cached) return cached
      }

      // Fetch pods for each monitored namespace and nodes in parallel
      const [namespaceResults, gpuNodes] = await Promise.all([
        Promise.all(
          namespaces.map(async (ns) => {
            try {
              const podInfos = await k8sAdapter.listPods(ns)
              const pods = podInfos.map(mapToPodPhaseInfo)
              const allRunning = pods.every((p) => p.phase === 'Running')

              return {
                namespace: ns,
                pods,
                allRunning,
              }
            } catch (error) {
              // Namespace might not exist or access denied - preserve error for UI
              return {
                namespace: ns,
                pods: [],
                allRunning: true, // No pods to check, treat as OK
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            }
          })
        ),
        fetchGpuNodesStatus(),
      ])

      // Extract Karpenter and LLM status from namespace results
      const karpenter = extractKarpenterStatus(namespaceResults)
      const llm = extractLlmStatus(namespaceResults)

      // Filter out karpenter and llm from namespaces display (they have dedicated sections)
      const displayNamespaces = namespaceResults.filter(
        (ns) => ns.namespace !== 'karpenter' && ns.namespace !== 'llm'
      )

      const overallStatus = namespaceResults.every((ns) => ns.allRunning) ? 'OK' : 'NG'

      const result: K8sMinimalStatus = {
        status: overallStatus,
        namespaces: displayNamespaces,
        karpenter,
        gpuNodes,
        llm,
        lastUpdated: new Date(),
      }

      cache.set(cacheKey, result, cacheTtlMs)
      return result
    },
  }
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Original K8sService implementation with Node/Job/Alert support
 * ============================================================================

import type { IK8sAdapter, K8sNodeInfo, K8sPodInfo, K8sJobInfo, K8sEventInfo } from './adapters/types.js'
import type { CacheService } from '../cache/memoryCache.js'
import type {
  K8sNode,
  K8sPod,
  K8sJob,
  K8sAlert,
  K8sClusterStats,
  K8sNodeStatus,
  K8sPodPhase,
  K8sJobStatus,
} from '../../domain/entities/k8s.js'
import { getAlertSeverity } from '../../domain/entities/k8s.js'

const CACHE_PREFIX = 'k8s:'
const RESTART_THRESHOLD = 3

export interface K8sService {
  // Nodes
  getNodes(forceRefresh?: boolean): Promise<K8sNode[]>
  getNodeDetails(name: string): Promise<K8sNode | null>

  // Pods
  getPods(namespace?: string, forceRefresh?: boolean): Promise<K8sPod[]>
  getPodDetails(namespace: string, name: string): Promise<K8sPod | null>

  // Jobs (MLOps focus)
  getJobs(namespace?: string, forceRefresh?: boolean): Promise<K8sJob[]>
  getJobDetails(namespace: string, name: string): Promise<K8sJob | null>

  // Namespaces
  getNamespaces(): Promise<string[]>

  // Alerts
  detectAlerts(): Promise<K8sAlert[]>

  // Stats
  getStats(): Promise<K8sClusterStats>
}

export function createK8sService(
  k8sAdapter: IK8sAdapter,
  cache: CacheService,
  cacheTtlMs: number
): K8sService {
  // ============================================================================
  // Mappers
  // ============================================================================

  function mapNodeStatus(conditions: K8sNodeInfo['status']['conditions']): K8sNodeStatus {
    const readyCondition = conditions.find((c) => c.type === 'Ready')
    if (!readyCondition) return 'Unknown'
    if (readyCondition.status === 'True') return 'Ready'
    if (readyCondition.status === 'False') return 'NotReady'
    return 'Unknown'
  }

  function mapToK8sNode(info: K8sNodeInfo): K8sNode {
    return {
      name: info.name,
      status: mapNodeStatus(info.status.conditions),
      conditions: info.status.conditions.map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastTransitionTime: c.lastTransitionTime ? new Date(c.lastTransitionTime) : undefined,
      })),
      capacity: {
        cpu: info.status.capacity.cpu,
        memory: info.status.capacity.memory,
        pods: info.status.capacity.pods,
        gpu: info.status.capacity['nvidia.com/gpu'],
      },
      allocatable: {
        cpu: info.status.allocatable.cpu,
        memory: info.status.allocatable.memory,
        pods: info.status.allocatable.pods,
        gpu: info.status.allocatable['nvidia.com/gpu'],
      },
      labels: info.labels,
      annotations: info.annotations,
      createdAt: info.creationTimestamp,
      nodeInfo: info.status.nodeInfo,
    }
  }

  function mapToK8sPod(info: K8sPodInfo): K8sPod {
    const restartCount = (info.status.containerStatuses || []).reduce(
      (sum, cs) => sum + cs.restartCount,
      0
    )

    return {
      name: info.name,
      namespace: info.namespace,
      nodeName: info.spec.nodeName || null,
      phase: info.status.phase as K8sPodPhase,
      restartCount,
      containerStatuses: (info.status.containerStatuses || []).map((cs) => {
        let state: 'running' | 'waiting' | 'terminated' = 'waiting'
        let stateReason: string | undefined
        let stateMessage: string | undefined

        if (cs.state.running) {
          state = 'running'
        } else if (cs.state.terminated) {
          state = 'terminated'
          stateReason = cs.state.terminated.reason
          stateMessage = cs.state.terminated.message
        } else if (cs.state.waiting) {
          state = 'waiting'
          stateReason = cs.state.waiting.reason
          stateMessage = cs.state.waiting.message
        }

        return {
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          state,
          stateReason,
          stateMessage,
          lastTerminationReason: cs.lastState?.terminated?.reason,
          lastTerminationExitCode: cs.lastState?.terminated?.exitCode,
        }
      }),
      createdAt: info.creationTimestamp,
      labels: info.labels,
      annotations: info.annotations,
      conditions: (info.status.conditions || []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
      })),
    }
  }

  function mapJobStatus(info: K8sJobInfo): K8sJobStatus {
    const conditions = info.status.conditions || []

    // Check for Failed condition
    const failedCondition = conditions.find((c) => c.type === 'Failed' && c.status === 'True')
    if (failedCondition) return 'Failed'

    // Check for Complete condition
    const completeCondition = conditions.find((c) => c.type === 'Complete' && c.status === 'True')
    if (completeCondition) return 'Succeeded'

    // Check for Suspended condition
    const suspendedCondition = conditions.find((c) => c.type === 'Suspended' && c.status === 'True')
    if (suspendedCondition) return 'Suspended'

    // If there are active pods, it's Active
    if ((info.status.active ?? 0) > 0) return 'Active'

    // Default to Active if job just started
    return 'Active'
  }

  function mapToK8sJob(info: K8sJobInfo): K8sJob {
    return {
      name: info.name,
      namespace: info.namespace,
      status: mapJobStatus(info),
      completions: info.spec.completions ?? 1,
      parallelism: info.spec.parallelism ?? 1,
      succeeded: info.status.succeeded ?? 0,
      failed: info.status.failed ?? 0,
      active: info.status.active ?? 0,
      startTime: info.status.startTime ? new Date(info.status.startTime) : null,
      completionTime: info.status.completionTime ? new Date(info.status.completionTime) : null,
      conditions: (info.status.conditions || []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastTransitionTime: c.lastTransitionTime ? new Date(c.lastTransitionTime) : undefined,
      })),
      labels: info.labels,
      annotations: info.annotations,
    }
  }

  // ============================================================================
  // Alert Detection
  // ============================================================================

  function detectPodRestarts(pods: K8sPod[]): K8sAlert[] {
    const alerts: K8sAlert[] = []

    for (const pod of pods) {
      if (pod.restartCount >= RESTART_THRESHOLD) {
        alerts.push({
          type: 'pod_restart',
          severity: getAlertSeverity('pod_restart', pod.restartCount),
          resource: { kind: 'Pod', name: pod.name, namespace: pod.namespace },
          message: `Pod ${pod.name} has restarted ${pod.restartCount} times`,
          detectedAt: new Date(),
          metadata: { restartCount: pod.restartCount },
        })
      }
    }

    return alerts
  }

  function detectOOMKills(pods: K8sPod[]): K8sAlert[] {
    const alerts: K8sAlert[] = []

    for (const pod of pods) {
      const oomContainers = pod.containerStatuses.filter(
        (cs) => cs.lastTerminationReason === 'OOMKilled'
      )

      for (const container of oomContainers) {
        alerts.push({
          type: 'oom_killed',
          severity: 'critical',
          resource: { kind: 'Pod', name: pod.name, namespace: pod.namespace },
          message: `Container ${container.name} in pod ${pod.name} was OOMKilled`,
          detectedAt: new Date(),
          metadata: {
            containerName: container.name,
            exitCode: container.lastTerminationExitCode,
          },
        })
      }
    }

    return alerts
  }

  function detectJobFailures(jobs: K8sJob[]): K8sAlert[] {
    const alerts: K8sAlert[] = []

    for (const job of jobs) {
      if (job.status === 'Failed') {
        const failedCondition = job.conditions.find(
          (c) => c.type === 'Failed' && c.status === 'True'
        )
        alerts.push({
          type: 'job_failed',
          severity: 'critical',
          resource: { kind: 'Job', name: job.name, namespace: job.namespace },
          message: `Job ${job.name} failed: ${failedCondition?.reason || 'Unknown reason'}`,
          detectedAt: new Date(),
          metadata: {
            reason: failedCondition?.reason,
            message: failedCondition?.message,
            failedCount: job.failed,
          },
        })
      }
    }

    return alerts
  }

  function detectNodeNotReady(nodes: K8sNode[]): K8sAlert[] {
    const alerts: K8sAlert[] = []

    for (const node of nodes) {
      if (node.status === 'NotReady') {
        const readyCondition = node.conditions.find((c) => c.type === 'Ready')
        alerts.push({
          type: 'node_not_ready',
          severity: 'critical',
          resource: { kind: 'Node', name: node.name },
          message: `Node ${node.name} is not ready: ${readyCondition?.reason || 'Unknown reason'}`,
          detectedAt: new Date(),
          metadata: {
            reason: readyCondition?.reason,
            message: readyCondition?.message,
          },
        })
      }
    }

    return alerts
  }

  // ============================================================================
  // Service Implementation
  // ============================================================================

  return {
    async getNodes(forceRefresh = false): Promise<K8sNode[]> {
      const cacheKey = `${CACHE_PREFIX}nodes`
      if (!forceRefresh) {
        const cached = cache.get<K8sNode[]>(cacheKey)
        if (cached) return cached
      }

      const nodeInfos = await k8sAdapter.listNodes()
      const nodes = nodeInfos.map(mapToK8sNode)
      cache.set(cacheKey, nodes, cacheTtlMs)
      return nodes
    },

    async getNodeDetails(name: string): Promise<K8sNode | null> {
      const info = await k8sAdapter.getNode(name)
      if (!info) return null
      return mapToK8sNode(info)
    },

    async getPods(namespace?: string, forceRefresh = false): Promise<K8sPod[]> {
      const cacheKey = namespace
        ? `${CACHE_PREFIX}pods:${namespace}`
        : `${CACHE_PREFIX}pods:all`

      if (!forceRefresh) {
        const cached = cache.get<K8sPod[]>(cacheKey)
        if (cached) return cached
      }

      const podInfos = await k8sAdapter.listPods(namespace)
      const pods = podInfos.map(mapToK8sPod)
      cache.set(cacheKey, pods, cacheTtlMs)
      return pods
    },

    async getPodDetails(namespace: string, name: string): Promise<K8sPod | null> {
      const info = await k8sAdapter.getPod(namespace, name)
      if (!info) return null
      return mapToK8sPod(info)
    },

    async getJobs(namespace?: string, forceRefresh = false): Promise<K8sJob[]> {
      const cacheKey = namespace
        ? `${CACHE_PREFIX}jobs:${namespace}`
        : `${CACHE_PREFIX}jobs:all`

      if (!forceRefresh) {
        const cached = cache.get<K8sJob[]>(cacheKey)
        if (cached) return cached
      }

      const jobInfos = await k8sAdapter.listJobs(namespace)
      const jobs = jobInfos.map(mapToK8sJob)
      cache.set(cacheKey, jobs, cacheTtlMs)
      return jobs
    },

    async getJobDetails(namespace: string, name: string): Promise<K8sJob | null> {
      const info = await k8sAdapter.getJob(namespace, name)
      if (!info) return null
      return mapToK8sJob(info)
    },

    async getNamespaces(): Promise<string[]> {
      const cacheKey = `${CACHE_PREFIX}namespaces`
      const cached = cache.get<string[]>(cacheKey)
      if (cached) return cached

      const namespaces = await k8sAdapter.listNamespaces()
      cache.set(cacheKey, namespaces, cacheTtlMs)
      return namespaces
    },

    async detectAlerts(): Promise<K8sAlert[]> {
      const [nodes, pods, jobs] = await Promise.all([
        this.getNodes(),
        this.getPods(),
        this.getJobs(),
      ])

      const alerts: K8sAlert[] = [
        ...detectNodeNotReady(nodes),
        ...detectPodRestarts(pods),
        ...detectOOMKills(pods),
        ...detectJobFailures(jobs),
      ]

      return alerts
    },

    async getStats(): Promise<K8sClusterStats> {
      const [nodes, pods, jobs, alerts] = await Promise.all([
        this.getNodes(),
        this.getPods(),
        this.getJobs(),
        this.detectAlerts(),
      ])

      return {
        nodes: {
          total: nodes.length,
          ready: nodes.filter((n) => n.status === 'Ready').length,
          notReady: nodes.filter((n) => n.status !== 'Ready').length,
        },
        pods: {
          total: pods.length,
          running: pods.filter((p) => p.phase === 'Running').length,
          pending: pods.filter((p) => p.phase === 'Pending').length,
          failed: pods.filter((p) => p.phase === 'Failed').length,
        },
        jobs: {
          total: jobs.length,
          active: jobs.filter((j) => j.status === 'Active').length,
          succeeded: jobs.filter((j) => j.status === 'Succeeded').length,
          failed: jobs.filter((j) => j.status === 'Failed').length,
        },
        alerts: {
          total: alerts.length,
          critical: alerts.filter((a) => a.severity === 'critical').length,
          warning: alerts.filter((a) => a.severity === 'warning').length,
        },
        lastUpdated: new Date(),
      }
    },
  }
}

============================================================================ */
