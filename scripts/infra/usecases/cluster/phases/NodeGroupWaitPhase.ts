/**
 * NodeGroupWaitPhase - waits for EKS node groups to become ACTIVE.
 *
 * Phase 4: NodeGroup ACTIVE
 */

import { NodeGroupMonitor } from '../../../infrastructure/kubernetes/monitor/NodeGroupMonitor.js';
import { TIMEOUTS, POLL_INTERVALS } from '../../../config/timeouts.js';
import type { ExecutablePhase, PhaseContext, PhaseResult, NodeGroupResult } from './types.js';

/**
 * Waits for all EKS node groups to reach ACTIVE state.
 */
export class NodeGroupWaitPhase implements ExecutablePhase<NodeGroupResult> {
  readonly name = 'NodeGroup Wait';
  readonly description = 'Waiting for node groups to become ACTIVE';

  async execute(context: PhaseContext): Promise<PhaseResult<NodeGroupResult>> {
    const { clusterName, region, log } = context;

    if (!clusterName) {
      return { success: false, error: 'Cluster name not provided' };
    }

    const monitor = new NodeGroupMonitor({
      clusterName,
      region,
      timeoutMs: TIMEOUTS.nodeGroup.active,
      intervalSec: POLL_INTERVALS.external,
    });

    const result = await monitor.waitForActive();

    if (!result.success) {
      return {
        success: false,
        error: result.reason ?? 'Node groups did not become ACTIVE',
      };
    }

    // Calculate expected node count and find primary ASG
    const expectedNodeCount = result.details.reduce(
      (sum, ng) => sum + (ng.desiredSize || 0),
      0
    );
    const primaryAsgName = result.details.find((ng) => ng.asgName)?.asgName;

    log.info(`Expected nodes: ${expectedNodeCount}, ASG: ${primaryAsgName || 'unknown'}`);

    return {
      success: true,
      data: {
        expectedNodeCount,
        primaryAsgName,
      },
    };
  }
}
