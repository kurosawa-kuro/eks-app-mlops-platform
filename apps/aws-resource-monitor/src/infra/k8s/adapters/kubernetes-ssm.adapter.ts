/**
 * Kubernetes SSM Adapter - Access K8s via SSM on Bastion host
 *
 * Used for private EKS clusters that are not directly accessible.
 * Executes kubectl commands on a bastion host via SSM.
 */

import type { SSMAdapter } from '../../aws/adapters/ssm.adapter.js'
import type { IK8sAdapter, K8sPodInfo, K8sNodeInfo } from './types.js'

export interface K8sSsmAdapterConfig {
  clusterName: string
  region: string
}

export class K8sSsmAdapter implements IK8sAdapter {
  private ssmAdapter: SSMAdapter
  private clusterName: string
  private region: string

  constructor(ssmAdapter: SSMAdapter, config: K8sSsmAdapterConfig) {
    this.ssmAdapter = ssmAdapter
    this.clusterName = config.clusterName
    this.region = config.region
  }

  private getKubectlCommands(kubectlArgs: string): string[] {
    const kubeconfigPath = '/tmp/.kube/config'
    return [
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${this.clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
      `kubectl ${kubectlArgs}`,
    ]
  }

  async listPods(namespace?: string): Promise<K8sPodInfo[]> {
    const nsFlag = namespace ? `-n ${namespace}` : '-A'
    // Use custom-columns to reduce output size (SSM has ~24KB limit)
    const commands = this.getKubectlCommands(
      `get pods ${nsFlag} -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,PHASE:.status.phase,NODE:.spec.nodeName --no-headers`
    )

    const result = await this.ssmAdapter.execute(commands, 30)

    if (!result.success || !result.output) {
      throw new Error(result.error || 'Failed to list pods')
    }

    // Handle "No resources found" message
    const output = result.output.trim()
    if (output.includes('No resources found') || output === '') {
      return []
    }

    // Parse custom-columns output (space-separated)
    const pods: K8sPodInfo[] = []
    const lines = output.split('\n').filter(line => line.trim())

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        const [name, ns, phase] = parts
        pods.push({
          name,
          namespace: ns,
          uid: '',
          labels: {},
          annotations: {},
          creationTimestamp: new Date(),
          spec: { nodeName: parts[3] || undefined },
          status: {
            phase: phase as K8sPodInfo['status']['phase'],
          },
        })
      }
    }

    return pods
  }

  async getPod(namespace: string, name: string): Promise<K8sPodInfo | null> {
    const commands = this.getKubectlCommands(`get pod ${name} -n ${namespace} -o json`)

    const result = await this.ssmAdapter.execute(commands, 30)

    if (!result.success || !result.output) {
      return null
    }

    try {
      const pod = JSON.parse(result.output)
      return this.mapPod(pod)
    } catch {
      return null
    }
  }

  async listPodsByLabel(namespace: string, labelSelector: string): Promise<K8sPodInfo[]> {
    const commands = this.getKubectlCommands(`get pods -n ${namespace} -l ${labelSelector} -o json`)

    const result = await this.ssmAdapter.execute(commands, 30)

    if (!result.success || !result.output) {
      throw new Error(result.error || 'Failed to list pods by label')
    }

    try {
      const data = JSON.parse(result.output)
      return (data.items || []).map((pod: KubePod) => this.mapPod(pod))
    } catch {
      throw new Error('Failed to parse kubectl output')
    }
  }

  async listNamespaces(): Promise<string[]> {
    const commands = this.getKubectlCommands('get namespaces -o json')

    const result = await this.ssmAdapter.execute(commands, 30)

    if (!result.success || !result.output) {
      throw new Error(result.error || 'Failed to list namespaces')
    }

    try {
      const data = JSON.parse(result.output)
      return (data.items || [])
        .map((ns: { metadata?: { name?: string } }) => ns.metadata?.name || '')
        .filter(Boolean)
    } catch {
      throw new Error('Failed to parse kubectl output')
    }
  }

  async listNodes(): Promise<K8sNodeInfo[]> {
    // Use simpler custom-columns (avoid JSONPath with special chars that break shell)
    const commands = this.getKubectlCommands(
      `get nodes -o custom-columns='NAME:.metadata.name,INSTANCE:.metadata.labels.node\\.kubernetes\\.io/instance-type,CAPACITY:.metadata.labels.karpenter\\.sh/capacity-type,GPU:.status.capacity.nvidia\\.com/gpu,CREATED:.metadata.creationTimestamp' --no-headers`
    )

    const result = await this.ssmAdapter.execute(commands, 30)

    if (!result.success || !result.output) {
      throw new Error(result.error || 'Failed to list nodes')
    }

    const output = result.output.trim()
    if (output.includes('No resources found') || output === '') {
      return []
    }

    // Parse custom-columns output
    const nodes: K8sNodeInfo[] = []
    const lines = output.split('\n').filter(line => line.trim())

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4) {
        const [name, instanceType, capacityType, gpu, created] = parts
        nodes.push({
          name,
          labels: {
            'node.kubernetes.io/instance-type': instanceType !== '<none>' ? instanceType : '',
            'karpenter.sh/capacity-type': capacityType !== '<none>' ? capacityType : '',
          },
          creationTimestamp: created && created !== '<none>' ? new Date(created) : new Date(),
          capacity: {
            cpu: '',
            memory: '',
            'nvidia.com/gpu': gpu !== '<none>' ? gpu : undefined,
          },
          conditions: [
            {
              type: 'Ready',
              status: 'True', // Assume ready if node is listed
            },
          ],
        })
      }
    }

    return nodes
  }

  private mapPod(pod: KubePod): K8sPodInfo {
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

  private mapContainerState(state?: ContainerState): NonNullable<K8sPodInfo['status']['containerStatuses']>[number]['state'] {
    if (state?.running) {
      return {
        running: {
          startedAt: state.running.startedAt || '',
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
}

// Types for kubectl JSON output
interface KubePod {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp?: string
  }
  spec?: {
    nodeName?: string
  }
  status?: {
    phase?: string
    conditions?: Array<{
      type?: string
      status?: string
      reason?: string
      message?: string
    }>
    containerStatuses?: Array<{
      name?: string
      ready?: boolean
      restartCount?: number
      state?: ContainerState
      lastState?: {
        terminated?: {
          reason?: string
          exitCode?: number
          message?: string
        }
      }
    }>
  }
}

interface ContainerState {
  running?: { startedAt?: string }
  waiting?: { reason?: string; message?: string }
  terminated?: { reason?: string; exitCode?: number; message?: string }
}
