/**
 * Kubernetes Entity Definitions
 * K8sリソースの型定義
 */

// ============================================================================
// K8s Node
// ============================================================================

export type K8sNodeStatus = 'Ready' | 'NotReady' | 'Unknown'

export interface K8sNodeCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: Date
}

export interface K8sNodeCapacity {
  cpu: string
  memory: string
  pods: string
  gpu?: string
}

export interface K8sNode {
  name: string
  status: K8sNodeStatus
  conditions: K8sNodeCondition[]
  capacity: K8sNodeCapacity
  allocatable: K8sNodeCapacity
  labels: Record<string, string>
  annotations: Record<string, string>
  createdAt: Date
  nodeInfo: {
    kubeletVersion: string
    osImage: string
    containerRuntimeVersion: string
    architecture: string
  }
}

// ============================================================================
// K8s Pod
// ============================================================================

export type K8sPodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'

export interface K8sContainerStatus {
  name: string
  ready: boolean
  restartCount: number
  state: 'running' | 'waiting' | 'terminated'
  stateReason?: string
  stateMessage?: string
  lastTerminationReason?: string
  lastTerminationExitCode?: number
}

export interface K8sPod {
  name: string
  namespace: string
  nodeName: string | null
  phase: K8sPodPhase
  restartCount: number
  containerStatuses: K8sContainerStatus[]
  createdAt: Date
  labels: Record<string, string>
  annotations: Record<string, string>
  conditions: Array<{
    type: string
    status: 'True' | 'False' | 'Unknown'
    reason?: string
    message?: string
  }>
}

// ============================================================================
// K8s Job (for MLOps)
// ============================================================================

export type K8sJobStatus = 'Active' | 'Succeeded' | 'Failed' | 'Suspended'

export interface K8sJobCondition {
  type: 'Complete' | 'Failed' | 'Suspended'
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: Date
}

export interface K8sJob {
  name: string
  namespace: string
  status: K8sJobStatus
  completions: number
  parallelism: number
  succeeded: number
  failed: number
  active: number
  startTime: Date | null
  completionTime: Date | null
  conditions: K8sJobCondition[]
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ============================================================================
// K8s Event
// ============================================================================

export interface K8sEvent {
  name: string
  namespace: string
  type: 'Normal' | 'Warning'
  reason: string
  message: string
  involvedObject: {
    kind: string
    name: string
    namespace?: string
  }
  firstTimestamp: Date | null
  lastTimestamp: Date | null
  count: number
}

// ============================================================================
// K8s Alerts
// ============================================================================

export type K8sAlertType =
  | 'pod_restart'
  | 'oom_killed'
  | 'job_failed'
  | 'node_not_ready'
  | 'threshold_exceeded'

export type K8sAlertSeverity = 'warning' | 'critical'

export interface K8sAlert {
  type: K8sAlertType
  severity: K8sAlertSeverity
  resource: {
    kind: string
    name: string
    namespace?: string
  }
  message: string
  detectedAt: Date
  metadata: Record<string, unknown>
}

// ============================================================================
// Prometheus Metrics
// ============================================================================

export interface MetricValue {
  timestamp: Date
  value: number
}

export interface MetricResult {
  metric: Record<string, string>
  value?: MetricValue
  values?: MetricValue[]
}

export interface PrometheusQueryResult {
  status: 'success' | 'error'
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string'
    result: MetricResult[]
  }
  error?: string
  errorType?: string
}

export interface ClusterMetricsSummary {
  cpu: {
    avg: number
    max: number
    unit: string
  }
  memory: {
    avg: number
    max: number
    unit: string
  }
  gpu: {
    avg: number
    max: number
    unit: string
  } | null
  podCount: number
  nodeCount: number
  timestamp: Date
}

// ============================================================================
// K8s Cluster Stats
// ============================================================================

export interface K8sClusterStats {
  nodes: {
    total: number
    ready: number
    notReady: number
  }
  pods: {
    total: number
    running: number
    pending: number
    failed: number
  }
  jobs: {
    total: number
    active: number
    succeeded: number
    failed: number
  }
  alerts: {
    total: number
    critical: number
    warning: number
  }
  lastUpdated: Date
}

// ============================================================================
// Helper Functions
// ============================================================================

export function isPodRestarting(pod: K8sPod, threshold = 3): boolean {
  return pod.restartCount >= threshold
}

export function isPodOOMKilled(pod: K8sPod): boolean {
  return pod.containerStatuses.some(
    (c) => c.lastTerminationReason === 'OOMKilled'
  )
}

export function isJobFailed(job: K8sJob): boolean {
  return job.status === 'Failed'
}

export function getAlertSeverity(alertType: K8sAlertType, restartCount?: number): K8sAlertSeverity {
  switch (alertType) {
    case 'oom_killed':
    case 'job_failed':
    case 'node_not_ready':
      return 'critical'
    case 'pod_restart':
      return restartCount && restartCount >= 5 ? 'critical' : 'warning'
    case 'threshold_exceeded':
      return 'warning'
    default:
      return 'warning'
  }
}
