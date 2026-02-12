/**
 * ClusterWaitPhase - waits for EKS cluster to become ACTIVE.
 *
 * Phase 3: Cluster ACTIVE
 */

import { ClusterMonitor } from '../../../infrastructure/kubernetes/monitor/ClusterMonitor.js';
import { TIMEOUTS, POLL_INTERVALS, msToSeconds } from '../../../config/timeouts.js';
import type { ExecutablePhase, PhaseContext, PhaseResult } from './types.js';

/**
 * Waits for the EKS cluster to reach ACTIVE state.
 */
export class ClusterWaitPhase implements ExecutablePhase {
  readonly name = 'Cluster Wait';
  readonly description = 'Waiting for EKS cluster to become ACTIVE';

  async execute(context: PhaseContext): Promise<PhaseResult> {
    const { clusterName, region, log } = context;

    if (!clusterName) {
      return { success: false, error: 'Cluster name not provided' };
    }

    const monitor = new ClusterMonitor({
      clusterName,
      region,
      timeoutMs: TIMEOUTS.cluster.active,
      intervalSec: POLL_INTERVALS.external,
    });

    const result = await monitor.waitForActive();

    if (!result.success) {
      return {
        success: false,
        error: result.reason ?? 'Cluster did not become ACTIVE',
      };
    }

    log.pass(`Cluster ${clusterName} is ACTIVE`);
    return { success: true };
  }
}
