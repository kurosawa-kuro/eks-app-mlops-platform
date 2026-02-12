/**
 * NodeReadyPhase - waits for Kubernetes nodes to become Ready.
 *
 * Phase 8: Kubernetes Node Ready
 * Uses SSM to run kubectl via bastion host (private EKS only).
 */

import { SSMCommandRunner } from '../../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { Poller } from '../../../framework/lifecycle/Poller.js';
import { c } from '../../../framework/logging/colors.js';
import type { ExecutablePhase, PhaseContext, PhaseResult, K8sNodeInfo } from './types.js';

/**
 * Result data from node ready phase.
 */
export interface NodeReadyResult {
  nodes: K8sNodeInfo[];
}

/**
 * Waits for all Kubernetes nodes to reach Ready state via SSM.
 */
export class NodeReadyPhase implements ExecutablePhase<NodeReadyResult> {
  readonly name = 'Node Ready';
  readonly description = 'Waiting for Kubernetes nodes to become Ready';

  async execute(context: PhaseContext): Promise<PhaseResult<NodeReadyResult>> {
    const { clusterName, region, expectedNodeCount, bastionInstanceId, log } = context;

    if (!clusterName) {
      return { success: false, error: 'Cluster name not provided' };
    }

    if (!bastionInstanceId) {
      log.warn('No bastion instance ID - skipping node check');
      return {
        success: true,
        skipped: true,
        skipReason: 'No bastion instance available',
        data: { nodes: [] },
      };
    }

    log.info(`Using SSM via bastion ${bastionInstanceId} for kubectl`);

    const ssm = new SSMCommandRunner(bastionInstanceId, region);
    const poller = new Poller(600, 15); // 10 min timeout, 15s interval
    const expected = expectedNodeCount || 1;
    let finalNodes: K8sNodeInfo[] = [];
    let emptyNodeAttempts = 0;

    // NOTE: kubeconfig is already updated by AuthCheckPhase
    // SSM AWS-RunShellScript runs each command in a separate subshell,
    // so we must join commands with && to preserve environment variables
    const kubectlCmd = [
      'export HOME=/root',
      'export KUBECONFIG=/root/.kube/config',
      'kubectl get nodes -o json',
    ].join(' && ');

    const result = await poller.poll(
      async () => {
        const ssmResult = await ssm.execute(kubectlCmd, { stream: false, label: 'kubectl get nodes' });

        if (!ssmResult.success || !ssmResult.output) {
          return { done: false, success: false, readyCount: 0, totalCount: 0, nodes: [] };
        }

        // Parse kubectl output - find the JSON part
        const jsonMatch = ssmResult.output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { done: false, success: false, readyCount: 0, totalCount: 0, nodes: [] };
        }

        try {
          const data = JSON.parse(jsonMatch[0]) as {
            items?: Array<{
              metadata?: { name?: string; labels?: Record<string, string> };
              status?: { conditions?: Array<{ type: string; status: string }> };
            }>;
          };

          const nodes: K8sNodeInfo[] = (data.items || []).map((node) => {
            const ready = node.status?.conditions?.find((cond) => cond.type === 'Ready');
            return {
              name: node.metadata?.name,
              ready: ready?.status === 'True',
              instanceType: node.metadata?.labels?.['node.kubernetes.io/instance-type'],
              zone: node.metadata?.labels?.['topology.kubernetes.io/zone'],
            };
          });

          finalNodes = nodes;
          const readyNodes = nodes.filter((n) => n.ready);
          const allReady = readyNodes.length >= expected;

          return {
            done: allReady,
            success: allReady,
            readyCount: readyNodes.length,
            totalCount: nodes.length,
            nodes,
          };
        } catch {
          return { done: false, success: false, readyCount: 0, totalCount: 0, nodes: [] };
        }
      },
      {
        onTick: (elapsed, interval, r) => {
          log.status(elapsed, interval, `Nodes: ${r.readyCount}/${r.totalCount} Ready (via SSM)`);
          if (r.totalCount === 0) {
            emptyNodeAttempts++;
            if (emptyNodeAttempts >= 2) {
              console.log(c.yellow('    Hint: 0 nodes may indicate kubelet has not joined yet'));
            }
          } else {
            for (const node of r.nodes) {
              const status = node.ready ? c.green('Ready') : c.yellow('NotReady');
              console.log(`    ${node.name}: ${status} (${node.instanceType || 'unknown'})`);
            }
          }
        },
        onSuccess: (r) => log.pass(`All ${r.readyCount} node(s) are Ready`),
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: 'Not all nodes became Ready',
        data: { nodes: finalNodes },
      };
    }

    return {
      success: true,
      data: { nodes: finalNodes },
    };
  }
}
