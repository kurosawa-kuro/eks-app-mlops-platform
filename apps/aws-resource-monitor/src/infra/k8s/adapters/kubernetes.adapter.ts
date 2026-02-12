/**
 * Kubernetes Adapter - Minimal Mode
 * Pod listing only
 *
 * Supports:
 * - IRSA (IAM Roles for Service Accounts) in EKS
 * - kubeconfig for local development
 */

import * as k8s from '@kubernetes/client-node'
import type {
  IK8sAdapter,
  K8sPodInfo,
  K8sNodeInfo,
} from './types.js'

export class K8sAdapter implements IK8sAdapter {
  private coreApi: k8s.CoreV1Api

  constructor() {
    const kc = new k8s.KubeConfig()

    // IRSA auto-detection: EKS sets AWS_WEB_IDENTITY_TOKEN_FILE
    // Otherwise, load from default kubeconfig (~/.kube/config)
    kc.loadFromDefault()

    this.coreApi = kc.makeApiClient(k8s.CoreV1Api)
  }

  // ============================================================================
  // Pods (Minimal Mode - Active)
  // ============================================================================

  async listPods(namespace?: string): Promise<K8sPodInfo[]> {
    const response = namespace
      ? await this.coreApi.listNamespacedPod({ namespace })
      : await this.coreApi.listPodForAllNamespaces()
    return (response.items || []).map(this.mapPod)
  }

  async getPod(namespace: string, name: string): Promise<K8sPodInfo | null> {
    try {
      const response = await this.coreApi.readNamespacedPod({ namespace, name })
      return this.mapPod(response)
    } catch {
      return null
    }
  }

  async listPodsByLabel(namespace: string, labelSelector: string): Promise<K8sPodInfo[]> {
    const response = await this.coreApi.listNamespacedPod({
      namespace,
      labelSelector,
    })
    return (response.items || []).map(this.mapPod)
  }

  // ============================================================================
  // Namespaces (Minimal Mode - Active)
  // ============================================================================

  async listNamespaces(): Promise<string[]> {
    const response = await this.coreApi.listNamespace()
    return (response.items || []).map((ns) => ns.metadata?.name || '').filter(Boolean)
  }

  // ============================================================================
  // Nodes
  // ============================================================================

  async listNodes(): Promise<K8sNodeInfo[]> {
    const response = await this.coreApi.listNode()
    return (response.items || []).map(this.mapNode)
  }

  private mapNode(node: k8s.V1Node): K8sNodeInfo {
    return {
      name: node.metadata?.name || '',
      labels: node.metadata?.labels || {},
      creationTimestamp: node.metadata?.creationTimestamp
        ? new Date(node.metadata.creationTimestamp)
        : new Date(),
      capacity: {
        cpu: node.status?.capacity?.cpu || '0',
        memory: node.status?.capacity?.memory || '0',
        'nvidia.com/gpu': node.status?.capacity?.['nvidia.com/gpu'],
      },
      conditions: (node.status?.conditions || []).map((c) => ({
        type: c.type || '',
        status: (c.status as 'True' | 'False' | 'Unknown') || 'Unknown',
      })),
    }
  }

  // ============================================================================
  // Pod Mapper
  // ============================================================================

  private mapPod(pod: k8s.V1Pod): K8sPodInfo {
    return {
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      uid: pod.metadata?.uid || '',
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      creationTimestamp: pod.metadata?.creationTimestamp
        ? new Date(pod.metadata.creationTimestamp)
        : new Date(),
      spec: {
        nodeName: pod.spec?.nodeName,
      },
      status: {
        phase: (pod.status?.phase as K8sPodInfo['status']['phase']) || 'Unknown',
        conditions: pod.status?.conditions?.map((c) => ({
          type: c.type || '',
          status: (c.status as 'True' | 'False' | 'Unknown') || 'Unknown',
          reason: c.reason,
          message: c.message,
        })),
        containerStatuses: pod.status?.containerStatuses?.map((cs) => ({
          name: cs.name || '',
          ready: cs.ready || false,
          restartCount: cs.restartCount || 0,
          state: this.mapContainerState(cs.state),
          lastState: cs.lastState
            ? {
                terminated: cs.lastState.terminated
                  ? {
                      reason: cs.lastState.terminated.reason || '',
                      exitCode: cs.lastState.terminated.exitCode || 0,
                      message: cs.lastState.terminated.message,
                    }
                  : undefined,
              }
            : undefined,
        })),
      },
    }
  }

  private mapContainerState(state?: k8s.V1ContainerState): NonNullable<K8sPodInfo['status']['containerStatuses']>[number]['state'] {
    if (state?.running) {
      return {
        running: {
          startedAt: state.running.startedAt?.toISOString() || '',
        },
      }
    }
    if (state?.waiting) {
      return {
        waiting: {
          reason: state.waiting.reason || '',
          message: state.waiting.message,
        },
      }
    }
    if (state?.terminated) {
      return {
        terminated: {
          reason: state.terminated.reason || '',
          exitCode: state.terminated.exitCode || 0,
          message: state.terminated.message,
        },
      }
    }
    return { waiting: { reason: 'Unknown' } }
  }

  /* ============================================================================
   * COMMENTED OUT FOR MINIMAL MODE
   * Node/Job/Event methods for future expansion
   * ============================================================================

  private batchApi: k8s.BatchV1Api

  // In constructor:
  // this.batchApi = kc.makeApiClient(k8s.BatchV1Api)

  // ============================================================================
  // Nodes
  // ============================================================================

  async listNodes(): Promise<K8sNodeInfo[]> {
    const response = await this.coreApi.listNode()
    return (response.items || []).map(this.mapNode)
  }

  async getNode(name: string): Promise<K8sNodeInfo | null> {
    try {
      const response = await this.coreApi.readNode({ name })
      return this.mapNode(response)
    } catch {
      return null
    }
  }

  // ============================================================================
  // Jobs
  // ============================================================================

  async listJobs(namespace?: string): Promise<K8sJobInfo[]> {
    const response = namespace
      ? await this.batchApi.listNamespacedJob({ namespace })
      : await this.batchApi.listJobForAllNamespaces()
    return (response.items || []).map(this.mapJob)
  }

  async getJob(namespace: string, name: string): Promise<K8sJobInfo | null> {
    try {
      const response = await this.batchApi.readNamespacedJob({ namespace, name })
      return this.mapJob(response)
    } catch {
      return null
    }
  }

  // ============================================================================
  // Events
  // ============================================================================

  async listEvents(namespace?: string, fieldSelector?: string): Promise<K8sEventInfo[]> {
    const response = namespace
      ? await this.coreApi.listNamespacedEvent({ namespace, fieldSelector })
      : await this.coreApi.listEventForAllNamespaces({ fieldSelector })
    return (response.items || []).map(this.mapEvent)
  }

  // ============================================================================
  // Node Mapper
  // ============================================================================

  private mapNode(node: k8s.V1Node): K8sNodeInfo {
    return {
      name: node.metadata?.name || '',
      uid: node.metadata?.uid || '',
      labels: node.metadata?.labels || {},
      annotations: node.metadata?.annotations || {},
      creationTimestamp: node.metadata?.creationTimestamp
        ? new Date(node.metadata.creationTimestamp)
        : new Date(),
      status: {
        conditions: (node.status?.conditions || []).map((c) => ({
          type: c.type || '',
          status: (c.status as 'True' | 'False' | 'Unknown') || 'Unknown',
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime?.toISOString(),
        })),
        capacity: {
          cpu: node.status?.capacity?.cpu || '0',
          memory: node.status?.capacity?.memory || '0',
          pods: node.status?.capacity?.pods || '0',
          'nvidia.com/gpu': node.status?.capacity?.['nvidia.com/gpu'],
        },
        allocatable: {
          cpu: node.status?.allocatable?.cpu || '0',
          memory: node.status?.allocatable?.memory || '0',
          pods: node.status?.allocatable?.pods || '0',
          'nvidia.com/gpu': node.status?.allocatable?.['nvidia.com/gpu'],
        },
        nodeInfo: {
          kubeletVersion: node.status?.nodeInfo?.kubeletVersion || '',
          osImage: node.status?.nodeInfo?.osImage || '',
          containerRuntimeVersion: node.status?.nodeInfo?.containerRuntimeVersion || '',
          architecture: node.status?.nodeInfo?.architecture || '',
        },
      },
    }
  }

  // ============================================================================
  // Job Mapper
  // ============================================================================

  private mapJob(job: k8s.V1Job): K8sJobInfo {
    return {
      name: job.metadata?.name || '',
      namespace: job.metadata?.namespace || '',
      uid: job.metadata?.uid || '',
      labels: job.metadata?.labels || {},
      annotations: job.metadata?.annotations || {},
      creationTimestamp: job.metadata?.creationTimestamp
        ? new Date(job.metadata.creationTimestamp)
        : new Date(),
      spec: {
        completions: job.spec?.completions,
        parallelism: job.spec?.parallelism,
      },
      status: {
        startTime: job.status?.startTime?.toISOString(),
        completionTime: job.status?.completionTime?.toISOString(),
        active: job.status?.active,
        succeeded: job.status?.succeeded,
        failed: job.status?.failed,
        conditions: job.status?.conditions?.map((c) => ({
          type: c.type as 'Complete' | 'Failed' | 'Suspended',
          status: (c.status as 'True' | 'False' | 'Unknown') || 'Unknown',
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime?.toISOString(),
        })),
      },
    }
  }

  // ============================================================================
  // Event Mapper
  // ============================================================================

  private mapEvent(event: k8s.CoreV1Event): K8sEventInfo {
    return {
      name: event.metadata?.name || '',
      namespace: event.metadata?.namespace || '',
      uid: event.metadata?.uid || '',
      type: (event.type as 'Normal' | 'Warning') || 'Normal',
      reason: event.reason || '',
      message: event.message || '',
      involvedObject: {
        kind: event.involvedObject?.kind || '',
        name: event.involvedObject?.name || '',
        namespace: event.involvedObject?.namespace,
        uid: event.involvedObject?.uid,
      },
      firstTimestamp: event.firstTimestamp?.toISOString() || null,
      lastTimestamp: event.lastTimestamp?.toISOString() || null,
      count: event.count || 1,
    }
  }

  ============================================================================ */
}
