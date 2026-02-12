/**
 * Kubernetes Adapter Type Definitions - Minimal Mode
 */

// ============================================================================
// K8s Node Types
// ============================================================================

export interface K8sNodeInfo {
  name: string
  labels: Record<string, string>
  creationTimestamp: Date
  capacity: {
    cpu: string
    memory: string
    'nvidia.com/gpu'?: string
  }
  conditions: Array<{
    type: string
    status: 'True' | 'False' | 'Unknown'
  }>
}

// ============================================================================
// K8s Pod Types (Minimal Mode - Active)
// ============================================================================

export interface K8sPodInfo {
  name: string
  namespace: string
  uid: string
  labels: Record<string, string>
  annotations: Record<string, string>
  creationTimestamp: Date
  spec: {
    nodeName?: string
  }
  status: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
    conditions?: Array<{
      type: string
      status: 'True' | 'False' | 'Unknown'
      reason?: string
      message?: string
    }>
    containerStatuses?: Array<{
      name: string
      ready: boolean
      restartCount: number
      state: {
        running?: { startedAt: string }
        waiting?: { reason: string; message?: string }
        terminated?: { reason: string; exitCode: number; message?: string }
      }
      lastState?: {
        terminated?: { reason: string; exitCode: number; message?: string }
      }
    }>
  }
}

// ============================================================================
// K8s Adapter Interface (Minimal Mode)
// ============================================================================

export interface IK8sAdapter {
  // Nodes
  listNodes(): Promise<K8sNodeInfo[]>

  // Pods (Minimal Mode - Active)
  listPods(namespace?: string): Promise<K8sPodInfo[]>
  getPod(namespace: string, name: string): Promise<K8sPodInfo | null>
  listPodsByLabel(namespace: string, labelSelector: string): Promise<K8sPodInfo[]>

  // Namespaces (Minimal Mode - Active)
  listNamespaces(): Promise<string[]>
}

/* ============================================================================
 * COMMENTED OUT FOR MINIMAL MODE
 * Node/Job/Event/Prometheus types for future expansion
 * ============================================================================

export interface K8sNodeInfo {
  name: string
  uid: string
  labels: Record<string, string>
  annotations: Record<string, string>
  creationTimestamp: Date
  status: {
    conditions: Array<{
      type: string
      status: 'True' | 'False' | 'Unknown'
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
    capacity: {
      cpu: string
      memory: string
      pods: string
      'nvidia.com/gpu'?: string
    }
    allocatable: {
      cpu: string
      memory: string
      pods: string
      'nvidia.com/gpu'?: string
    }
    nodeInfo: {
      kubeletVersion: string
      osImage: string
      containerRuntimeVersion: string
      architecture: string
    }
  }
}

export interface K8sJobInfo {
  name: string
  namespace: string
  uid: string
  labels: Record<string, string>
  annotations: Record<string, string>
  creationTimestamp: Date
  spec: {
    completions?: number
    parallelism?: number
  }
  status: {
    startTime?: string
    completionTime?: string
    active?: number
    succeeded?: number
    failed?: number
    conditions?: Array<{
      type: 'Complete' | 'Failed' | 'Suspended'
      status: 'True' | 'False' | 'Unknown'
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
  }
}

export interface K8sEventInfo {
  name: string
  namespace: string
  uid: string
  type: 'Normal' | 'Warning'
  reason: string
  message: string
  involvedObject: {
    kind: string
    name: string
    namespace?: string
    uid?: string
  }
  firstTimestamp: string | null
  lastTimestamp: string | null
  count: number
}

// Full IK8sAdapter interface
export interface IK8sAdapter {
  // Nodes
  listNodes(): Promise<K8sNodeInfo[]>
  getNode(name: string): Promise<K8sNodeInfo | null>

  // Pods
  listPods(namespace?: string): Promise<K8sPodInfo[]>
  getPod(namespace: string, name: string): Promise<K8sPodInfo | null>
  listPodsByLabel(namespace: string, labelSelector: string): Promise<K8sPodInfo[]>

  // Jobs
  listJobs(namespace?: string): Promise<K8sJobInfo[]>
  getJob(namespace: string, name: string): Promise<K8sJobInfo | null>

  // Events
  listEvents(namespace?: string, fieldSelector?: string): Promise<K8sEventInfo[]>

  // Namespaces
  listNamespaces(): Promise<string[]>
}

// ============================================================================
// Prometheus Types
// ============================================================================

export interface PrometheusResponse<T> {
  status: 'success' | 'error'
  data: T
  errorType?: string
  error?: string
}

export interface PrometheusVectorResult {
  resultType: 'vector'
  result: Array<{
    metric: Record<string, string>
    value: [number, string]  // [timestamp, value]
  }>
}

export interface PrometheusMatrixResult {
  resultType: 'matrix'
  result: Array<{
    metric: Record<string, string>
    values: Array<[number, string]>  // [[timestamp, value], ...]
  }>
}

export type PrometheusQueryData = PrometheusVectorResult | PrometheusMatrixResult

// ============================================================================
// Prometheus Adapter Interface
// ============================================================================

export interface IPrometheusAdapter {
  // Instant query
  query(promql: string): Promise<PrometheusResponse<PrometheusVectorResult>>

  // Range query
  queryRange(
    promql: string,
    start: Date,
    end: Date,
    step: string
  ): Promise<PrometheusResponse<PrometheusMatrixResult>>

  // Health check
  isHealthy(): Promise<boolean>
}

============================================================================ */
