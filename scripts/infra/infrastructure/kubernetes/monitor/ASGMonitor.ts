/**
 * ASGMonitor - monitors Auto Scaling Group instances.
 *
 * Polls ASG instances until expected count are InService with SSM Online.
 */

import { Poller } from '../../../framework/lifecycle/Poller.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { aws } from '../../shell/index.js';
import { safeParseJson, ASGInstancesSchema } from '../../types.js';
import { ssmGetInstanceStatus } from '../../aws/runtime/SSMCommandRunner.js';
import type { MonitorConfig, ASGMonitorResult, ASGInstance } from './monitors-types.js';

export interface ASGMonitorConfig extends MonitorConfig {
  asgName: string;
  expectedCount: number;
}

/**
 * Monitor ASG instances and wait for them to be ready.
 *
 * @example
 * const monitor = new ASGMonitor({
 *   asgName: 'my-asg',
 *   expectedCount: 2,
 *   timeoutMs: 600000,
 *   intervalSec: 30,
 *   region: 'ap-northeast-1',
 * });
 * const result = await monitor.waitForReady();
 * if (result.success) {
 *   console.log('All instances are ready!');
 * }
 */
export class ASGMonitor {
  private config: ASGMonitorConfig;
  private log: typeof defaultLog;

  constructor(config: ASGMonitorConfig) {
    this.config = config;
    this.log = (config.logger as typeof defaultLog) ?? defaultLog;
  }

  /**
   * Get instances in the ASG.
   */
  getInstances(): ASGInstance[] {
    const result = aws(
      `autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${this.config.asgName} --query 'AutoScalingGroups[0].Instances' --output json`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return [];
    const parsed = safeParseJson(result.output, ASGInstancesSchema);
    if (!parsed) return [];

    return parsed.map((i) => ({
      instanceId: i.InstanceId,
      lifecycleState: i.LifecycleState,
      healthStatus: i.HealthStatus,
    }));
  }

  /**
   * Poll ASG until expected instances are InService with SSM Online.
   */
  async waitForReady(): Promise<ASGMonitorResult> {
    const poller = new Poller(
      this.config.timeoutMs / 1000,
      this.config.intervalSec
    );

    const result = await poller.poll(
      async () => {
        const instances = this.getInstances();
        const inService = instances.filter((i) => i.lifecycleState === 'InService');
        const ssmOnline = instances.filter((i) => {
          const status = ssmGetInstanceStatus(i.instanceId, this.config.region);
          return status.status === 'Online';
        });

        const ready =
          inService.length >= this.config.expectedCount &&
          ssmOnline.length >= this.config.expectedCount;

        return {
          done: ready,
          success: ready,
          instances,
          inService,
          ssmOnline,
        };
      },
      {
        onTick: (elapsed, interval, r) => {
          this.log.status(
            elapsed,
            interval,
            `ASG: ${r.inService.length}/${r.instances.length} InService, ${r.ssmOnline.length} SSM Online`
          );
          for (const inst of r.instances) {
            const state =
              inst.lifecycleState === 'InService'
                ? c.green(inst.lifecycleState)
                : c.yellow(inst.lifecycleState);
            const ssm = ssmGetInstanceStatus(inst.instanceId, this.config.region);
            const ssmColor =
              ssm.status === 'Online' ? c.green(ssm.status) : c.yellow(ssm.status);
            console.log(`    ${inst.instanceId}: ${state}, SSM: ${ssmColor}`);
          }
        },
        onSuccess: () => {
          this.log.pass(
            `All ${this.config.expectedCount} instance(s) are InService with SSM Online`
          );
        },
      }
    );

    return {
      success: result.success,
      instances: result.instances ?? [],
      inServiceCount: result.inService?.length ?? 0,
      ssmOnlineCount: result.ssmOnline?.length ?? 0,
      reason: result.reason,
    };
  }
}
