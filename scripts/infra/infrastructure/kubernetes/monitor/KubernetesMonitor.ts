/**
 * KubernetesMonitor - monitors Kubernetes cluster via kubectl.
 *
 * Provides methods for:
 * - Updating kubeconfig
 * - Getting node information
 * - Waiting for nodes to be ready
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { Poller } from '../../../framework/lifecycle/Poller.js';
import type { Logger } from '../../../framework/types.js';

/**
 * Kubernetes node information
 */
export interface K8sNode {
  name?: string;
  ready: boolean;
  instanceType?: string;
  zone?: string;
}

/**
 * Result of waiting for nodes
 */
export interface NodeReadyResult {
  success: boolean;
  nodes: K8sNode[];
}

/**
 * Dependencies for KubernetesMonitor
 */
export interface KubernetesMonitorDependencies {
  run: typeof defaultRun;
  log: Logger;
}

const defaultDependencies: KubernetesMonitorDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/**
 * Configuration for KubernetesMonitor
 */
export interface KubernetesMonitorConfig {
  clusterName: string;
  region: string;
  pollIntervalSec?: number;
  timeoutSec?: number;
}

/**
 * Monitors Kubernetes cluster state via kubectl.
 *
 * @example
 * const monitor = new KubernetesMonitor({
 *   clusterName: 'my-cluster',
 *   region: 'ap-northeast-1'
 * });
 *
 * if (monitor.updateKubeconfig()) {
 *   const result = await monitor.waitForNodesReady(3);
 *   if (result.success) {
 *     console.log('All nodes ready:', result.nodes);
 *   }
 * }
 */
export class KubernetesMonitor {
  private config: KubernetesMonitorConfig;
  private deps: KubernetesMonitorDependencies;

  constructor(
    config: KubernetesMonitorConfig,
    deps: Partial<KubernetesMonitorDependencies> = {}
  ) {
    this.config = {
      pollIntervalSec: 15,
      timeoutSec: 600,
      ...config,
    };
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Update kubeconfig for the cluster.
   */
  updateKubeconfig(): boolean {
    process.stdout.write('Updating kubeconfig... ');
    try {
      this.deps.run(
        `aws eks update-kubeconfig --region ${this.config.region} --name ${this.config.clusterName}`
      );
      console.log(c.green('OK'));
      return true;
    } catch {
      console.log(c.red('FAILED'));
      return false;
    }
  }

  /**
   * Get all nodes in the cluster.
   */
  getNodes(): K8sNode[] {
    try {
      const result = this.deps.run('kubectl get nodes -o json', { ignoreError: true });
      if (!result) return [];

      const data = JSON.parse(result) as {
        items?: Array<{
          metadata?: {
            name?: string;
            labels?: Record<string, string>;
          };
          status?: {
            conditions?: Array<{
              type: string;
              status: string;
            }>;
          };
        }>;
      };

      return (data.items || []).map((node) => {
        const ready = node.status?.conditions?.find((cond) => cond.type === 'Ready');
        return {
          name: node.metadata?.name,
          ready: ready?.status === 'True',
          instanceType: node.metadata?.labels?.['node.kubernetes.io/instance-type'],
          zone: node.metadata?.labels?.['topology.kubernetes.io/zone'],
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get count of ready nodes.
   */
  getReadyNodeCount(): number {
    const nodes = this.getNodes();
    return nodes.filter(n => n.ready).length;
  }

  /**
   * Check if kubectl can connect to the cluster.
   */
  canConnect(): boolean {
    try {
      const result = this.deps.run('kubectl cluster-info', { ignoreError: true });
      return result !== null && result.includes('Kubernetes');
    } catch {
      return false;
    }
  }

  /**
   * Wait for all nodes to be ready.
   *
   * @param expectedCount - Expected number of ready nodes
   * @param onDiagnostics - Optional callback for running diagnostics
   */
  async waitForNodesReady(
    expectedCount: number,
    onDiagnostics?: (elapsed: number) => Promise<void>
  ): Promise<NodeReadyResult> {
    const poller = new Poller(this.config.timeoutSec!, this.config.pollIntervalSec!);
    let finalNodes: K8sNode[] = [];
    let lastDiagCheck = 0;
    const diagIntervalSec = 60; // Run diagnostics every 60 seconds

    const result = await poller.poll(
      async (elapsed) => {
        const nodes = this.getNodes();
        finalNodes = nodes;
        const readyNodes = nodes.filter((n) => n.ready);

        // Run diagnostics if provided
        if (onDiagnostics && elapsed - lastDiagCheck >= diagIntervalSec) {
          lastDiagCheck = elapsed;
          await onDiagnostics(elapsed);
        }

        const ready = readyNodes.length >= expectedCount;
        return {
          done: ready,
          success: ready,
          nodes,
          readyNodes,
          readyCount: readyNodes.length,
          totalCount: nodes.length,
        };
      },
      {
        onTick: (elapsed, interval, r) => {
          this.deps.log.status(elapsed, interval, `Nodes: ${r.readyCount}/${r.totalCount} Ready`);
          for (const node of r.nodes) {
            const status = node.ready ? c.green('Ready') : c.yellow('NotReady');
            console.log(`    ${node.name}: ${status} (${node.instanceType || 'unknown'})`);
          }
        },
        onSuccess: (r) => this.deps.log.pass(`All ${r.readyCount} node(s) are Ready`),
      }
    );

    return { success: result.success, nodes: finalNodes };
  }

  /**
   * Get cluster info.
   */
  getClusterInfo(): string | null {
    return this.deps.run('kubectl cluster-info', { ignoreError: true });
  }

  /**
   * Get cluster version.
   */
  getServerVersion(): string | null {
    try {
      const result = this.deps.run('kubectl version -o json', { ignoreError: true });
      if (!result) return null;
      const data = JSON.parse(result) as { serverVersion?: { gitVersion?: string } };
      return data.serverVersion?.gitVersion || null;
    } catch {
      return null;
    }
  }
}
