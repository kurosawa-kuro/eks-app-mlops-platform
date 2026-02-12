/**
 * ASGWaitPhase - waits for ASG instances to become ready.
 *
 * Phase 5: ASG Instance READY
 */

import { ASGMonitor } from '../../../infrastructure/kubernetes/monitor/ASGMonitor.js';
import { TIMEOUTS, POLL_INTERVALS } from '../../../config/timeouts.js';
import type { ExecutablePhase, PhaseContext, PhaseResult, ASGInstance } from './types.js';

/**
 * Result data from ASG wait phase.
 */
export interface ASGWaitResult {
  instances: ASGInstance[];
}

/**
 * Waits for all ASG instances to reach InService state.
 */
export class ASGWaitPhase implements ExecutablePhase<ASGWaitResult> {
  readonly name = 'ASG Wait';
  readonly description = 'Waiting for ASG instances to become ready';

  async execute(context: PhaseContext): Promise<PhaseResult<ASGWaitResult>> {
    const { primaryAsgName, expectedNodeCount, region, log } = context;

    if (!primaryAsgName) {
      log.warn('No ASG name provided, skipping ASG wait');
      return { success: true, skipped: true, skipReason: 'No ASG name provided' };
    }

    const monitor = new ASGMonitor({
      asgName: primaryAsgName,
      region,
      expectedCount: expectedNodeCount || 1,
      timeoutMs: TIMEOUTS.asg.instanceReady,
      intervalSec: POLL_INTERVALS.external,
    });

    const result = await monitor.waitForReady();

    const instances: ASGInstance[] = result.instances.map((i) => ({
      instanceId: i.instanceId,
      state: i.lifecycleState,
      zone: '', // ASG doesn't provide zone directly
    }));

    if (!result.success) {
      log.warn('Some ASG instances may not be ready, continuing...');
      return {
        success: true, // Non-fatal, continue
        data: { instances },
      };
    }

    return {
      success: true,
      data: { instances },
    };
  }
}
