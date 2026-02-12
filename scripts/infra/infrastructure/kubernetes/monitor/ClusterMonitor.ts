/**
 * ClusterMonitor - monitors EKS cluster status.
 *
 * Polls the cluster status until it becomes ACTIVE, FAILED, or times out.
 */

import { Poller } from '../../../framework/lifecycle/Poller.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { aws } from '../../shell/index.js';
import type { MonitorConfig, ClusterMonitorResult } from './monitors-types.js';

export interface ClusterMonitorConfig extends MonitorConfig {
  clusterName: string;
}

/**
 * Monitor EKS cluster status and wait for it to become ACTIVE.
 *
 * @example
 * const monitor = new ClusterMonitor({
 *   clusterName: 'my-cluster',
 *   timeoutMs: 1800000,
 *   intervalSec: 30,
 *   region: 'ap-northeast-1',
 * });
 * const result = await monitor.waitForActive();
 * if (result.success) {
 *   console.log('Cluster is active!');
 * }
 */
export class ClusterMonitor {
  private config: ClusterMonitorConfig;
  private log: typeof defaultLog;

  constructor(config: ClusterMonitorConfig) {
    this.config = config;
    this.log = (config.logger as typeof defaultLog) ?? defaultLog;
  }

  /**
   * Get the current cluster status.
   */
  getStatus(): string {
    const result = aws(
      `eks describe-cluster --name ${this.config.clusterName} --query 'cluster.status' --output text`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return 'NOT_FOUND';
    return result.output.trim() || 'UNKNOWN';
  }

  /**
   * Poll cluster status until ACTIVE, FAILED, or timeout.
   */
  async waitForActive(): Promise<ClusterMonitorResult> {
    const poller = new Poller(
      this.config.timeoutMs / 1000,
      this.config.intervalSec
    );

    const result = await poller.poll(
      async () => {
        const status = this.getStatus();
        const done = status === 'ACTIVE' || status === 'FAILED' || status === 'NOT_FOUND';
        return { done, success: status === 'ACTIVE', status };
      },
      {
        onTick: (elapsed, interval, r) => {
          this.log.status(elapsed, interval, `Cluster status: ${r.status}`);
        },
        onSuccess: () => {
          this.log.pass('Cluster is ACTIVE');
        },
        onFailure: (r) => {
          this.log.fail(`Cluster status: ${r.status}`);
        },
      }
    );

    return {
      success: result.success,
      status: result.status,
      reason: result.reason,
    };
  }
}
