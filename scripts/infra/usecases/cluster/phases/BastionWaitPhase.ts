/**
 * BastionWaitPhase - waits for bastion host SSM to come online.
 *
 * Phase 6: Bastion SSM Online
 */

import { BastionMonitor } from '../../../infrastructure/kubernetes/monitor/BastionMonitor.js';
import { TIMEOUTS, POLL_INTERVALS } from '../../../config/timeouts.js';
import { c } from '../../../framework/logging/colors.js';
import type { ExecutablePhase, PhaseContext, PhaseResult } from './types.js';

/**
 * Waits for bastion host to become SSM-accessible.
 */
export class BastionWaitPhase implements ExecutablePhase {
  readonly name = 'Bastion Wait';
  readonly description = 'Waiting for bastion SSM to come online';

  async execute(context: PhaseContext): Promise<PhaseResult> {
    const { bastionInstanceId, region, log } = context;

    // Warn if no bastion instance ID
    if (!bastionInstanceId) {
      log.warn('Bastion instance ID not found in Terraform outputs');
      log.warn('Skipping bastion SSM check');
      return { success: true, skipped: true, skipReason: 'No bastion instance ID' };
    }

    const monitor = new BastionMonitor({
      instanceId: bastionInstanceId,
      region,
      timeoutMs: TIMEOUTS.bastion.ssmOnline,
      intervalSec: POLL_INTERVALS.bastion,
    });

    const result = await monitor.waitForSSMOnline();

    if (!result.success) {
      // Provide detailed error messages based on failure reason
      console.log('');
      log.fail('=== Bastion SSM Connection Failed ===');
      log.fail('Private EKS operations require Bastion SSM connectivity');
      console.log('');

      if (result.reason === 'MINIMAL_AMI') {
        console.log(c.red('Cause: Minimal AMI is being used'));
        console.log(c.yellow('Fix:'));
        console.log('  1. Update bastion.tf AMI filter:');
        console.log('     values = ["al2023-ami-2023.*-x86_64"]');
        console.log('  2. Replace the instance:');
        console.log('     terraform apply -replace="aws_instance.bastion"');
      } else if (result.reason === 'TIMEOUT') {
        console.log(c.red('Cause: SSM Agent did not come online'));
        console.log(c.yellow('Check:'));
        console.log('  - VPC Endpoints exist (ssm, ssmmessages, ec2messages)');
        console.log('  - VPC Endpoint Security Groups allow 443/tcp');
        console.log('  - IAM Role has AmazonSSMManagedInstanceCore');
      }
      console.log('');

      return {
        success: false,
        error: `Bastion SSM failed: ${result.reason}`,
      };
    }

    log.pass('Bastion SSM is online');
    return { success: true };
  }
}
