/**
 * BastionMonitor - monitors Bastion host SSM connectivity.
 *
 * Polls the bastion instance until SSM Agent comes online.
 */

import { Poller } from '../../../framework/lifecycle/Poller.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { aws } from '../../shell/index.js';
import { safeParseJson, EC2AMISchema } from '../../types.js';
import { ssmGetInstanceStatus } from '../../aws/runtime/SSMCommandRunner.js';
import type { MonitorConfig, BastionMonitorResult } from './monitors-types.js';

export interface BastionMonitorConfig extends MonitorConfig {
  instanceId: string;
}

interface InstanceInfo {
  state?: string;
  instanceType?: string;
  privateIp?: string;
  imageId?: string;
}

interface AMIInfo {
  name?: string;
  isMinimal?: boolean;
}

/**
 * Monitor Bastion host and wait for SSM Agent to come online.
 *
 * @example
 * const monitor = new BastionMonitor({
 *   instanceId: 'i-1234567890abcdef0',
 *   timeoutMs: 300000,
 *   intervalSec: 10,
 *   region: 'ap-northeast-1',
 * });
 * const result = await monitor.waitForSSMOnline();
 * if (result.success) {
 *   console.log('Bastion is ready!');
 * }
 */
export class BastionMonitor {
  private config: BastionMonitorConfig;
  private log: typeof defaultLog;

  constructor(config: BastionMonitorConfig) {
    this.config = config;
    this.log = (config.logger as typeof defaultLog) ?? defaultLog;
  }

  /**
   * Get EC2 instance information.
   */
  private getInstanceInfo(): InstanceInfo | null {
    const result = aws(
      `ec2 describe-instances --instance-ids ${this.config.instanceId} --query 'Reservations[0].Instances[0]' --output json`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return null;

    try {
      const data = JSON.parse(result.output);
      return {
        state: data?.State?.Name,
        instanceType: data?.InstanceType,
        privateIp: data?.PrivateIpAddress,
        imageId: data?.ImageId,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get AMI information.
   */
  private getAMIInfo(imageId: string): AMIInfo | null {
    const result = aws(
      `ec2 describe-images --image-ids ${imageId} --query 'Images[0]' --output json`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return null;

    const parsed = safeParseJson(result.output, EC2AMISchema);
    if (!parsed) return null;

    const name = parsed.Name ?? '';
    const isMinimal = name.toLowerCase().includes('minimal');

    return { name, isMinimal };
  }

  /**
   * Wait for SSM Agent to come online.
   */
  async waitForSSMOnline(): Promise<BastionMonitorResult> {
    // Pre-flight checks
    const inst = this.getInstanceInfo();
    if (!inst) {
      this.log.fail(`Bastion instance ${this.config.instanceId} not found`);
      return { success: false, reason: 'INSTANCE_NOT_FOUND' };
    }

    this.log.info(`Bastion: ${this.config.instanceId} (${inst.instanceType}, ${inst.privateIp})`);

    // Check AMI
    if (inst.imageId) {
      const ami = this.getAMIInfo(inst.imageId);
      if (ami?.isMinimal) {
        this.log.fail(`Minimal AMI detected: ${ami.name}`);
        this.log.fail('Minimal AMI does not include SSM Agent');
        return { success: false, reason: 'MINIMAL_AMI', amiName: ami.name };
      }
      if (ami?.name) {
        this.log.info(`AMI: ${ami.name}`);
      }
    }

    // Check instance state
    if (inst.state !== 'running') {
      this.log.fail(`Bastion instance is ${inst.state} (expected: running)`);
      return { success: false, reason: 'INSTANCE_NOT_RUNNING' };
    }

    console.log('');
    this.log.info('Waiting for SSM Agent to come online...');

    const poller = new Poller(
      this.config.timeoutMs / 1000,
      this.config.intervalSec
    );
    let diagShown = false;

    const result = await poller.poll(
      async (elapsed) => {
        const ssm = ssmGetInstanceStatus(this.config.instanceId, this.config.region);

        // Show diagnostics after 60 seconds of waiting
        if (elapsed >= 60 && ssm.status === 'NOT_CONNECTED' && !diagShown) {
          diagShown = true;
          console.log(c.yellow('\n  [SSM Connection Diagnostics]'));
          console.log(c.dim('  Possible causes:'));
          console.log(c.dim('    1. SSM Agent starting up (wait a bit more)'));
          console.log(c.dim('    2. SSM Agent not installed (Minimal AMI?)'));
          console.log(c.dim('    3. VPC Endpoint or Security Group misconfiguration'));
          console.log(c.dim('    4. IAM Role missing AmazonSSMManagedInstanceCore'));
          console.log('');
        }

        return {
          done: ssm.status === 'Online',
          success: ssm.status === 'Online',
          ssmStatus: ssm.status,
          agentVersion: ssm.details?.agentVersion,
        };
      },
      {
        onTick: (elapsed, interval, r) => {
          this.log.status(elapsed, interval, `Bastion SSM: ${r.ssmStatus}`);
        },
        onSuccess: (r) => {
          this.log.pass(`Bastion is SSM Online (Agent: ${r.agentVersion ?? 'unknown'})`);
        },
        onFailure: () => {
          const timeoutSec = Math.floor(this.config.timeoutMs / 1000);
          this.log.fail(`Timeout: Bastion SSM did not come online within ${timeoutSec}s`);
          this.log.fail(
            `Manual check: aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${this.config.instanceId}"`
          );
        },
      }
    );

    return {
      success: result.success,
      agentVersion: result.agentVersion,
      reason: result.reason,
    };
  }
}
