/**
 * NodeGroupMonitor - monitors EKS node group status.
 *
 * Polls all node groups in a cluster until they become ACTIVE or fail.
 */

import { Poller } from '../../../framework/lifecycle/Poller.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { aws } from '../../shell/index.js';
import { safeParseJson, EKSListNodeGroupsSchema, EKSDescribeNodeGroupSchema } from '../../types.js';
import type { MonitorConfig, NodeGroupMonitorResult, NodeGroupInfo } from './monitors-types.js';

export interface NodeGroupMonitorConfig extends MonitorConfig {
  clusterName: string;
}

/**
 * Monitor EKS node groups and wait for all to become ACTIVE.
 *
 * @example
 * const monitor = new NodeGroupMonitor({
 *   clusterName: 'my-cluster',
 *   timeoutMs: 600000,
 *   intervalSec: 30,
 *   region: 'ap-northeast-1',
 * });
 * const result = await monitor.waitForActive();
 * if (result.success) {
 *   console.log('All node groups are active!');
 * }
 */
export class NodeGroupMonitor {
  private config: NodeGroupMonitorConfig;
  private log: typeof defaultLog;

  constructor(config: NodeGroupMonitorConfig) {
    this.config = config;
    this.log = (config.logger as typeof defaultLog) ?? defaultLog;
  }

  /**
   * List all node groups in the cluster.
   */
  listNodeGroups(): string[] {
    const result = aws(
      `eks list-nodegroups --cluster-name ${this.config.clusterName} --output json`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return [];
    const parsed = safeParseJson(result.output, EKSListNodeGroupsSchema);
    return parsed?.nodegroups ?? [];
  }

  /**
   * Describe a specific node group.
   */
  describeNodeGroup(nodeGroupName: string): NodeGroupInfo | null {
    const result = aws(
      `eks describe-nodegroup --cluster-name ${this.config.clusterName} --nodegroup-name ${nodeGroupName} --output json`,
      { silent: true, region: this.config.region, throwOnError: false }
    );
    if (!result.success) return null;

    const parsed = safeParseJson(result.output, EKSDescribeNodeGroupSchema);
    if (!parsed?.nodegroup) return null;

    const ng = parsed.nodegroup;
    return {
      name: ng.nodegroupName,
      status: ng.status,
      desiredSize: ng.scalingConfig?.desiredSize,
      asgName: ng.resources?.autoScalingGroups?.[0]?.name,
      healthIssues: ng.health?.issues ?? [],
    };
  }

  /**
   * Poll all node groups until all are ACTIVE, any FAILED/DEGRADED, or timeout.
   */
  async waitForActive(): Promise<NodeGroupMonitorResult> {
    let lastDetails: NodeGroupInfo[] = [];
    const poller = new Poller(
      this.config.timeoutMs / 1000,
      this.config.intervalSec
    );

    const result = await poller.poll(
      async () => {
        const nodegroups = this.listNodeGroups();
        if (nodegroups.length === 0) {
          return { done: false, success: false, status: 'NO_NODEGROUPS', details: [] };
        }

        const details = nodegroups
          .map((ng) => this.describeNodeGroup(ng))
          .filter(Boolean) as NodeGroupInfo[];
        lastDetails = details;

        const failed = details.find(
          (d) => d.status === 'CREATE_FAILED' || d.status === 'DEGRADED'
        );
        if (failed) {
          return { done: true, success: false, details, failedNg: failed };
        }

        const allActive = details.every((d) => d.status === 'ACTIVE');
        return { done: allActive, success: allActive, details };
      },
      {
        onTick: (elapsed, interval, r) => {
          if (r.status === 'NO_NODEGROUPS') {
            this.log.status(elapsed, interval, 'No node groups found yet');
          } else {
            const line = r.details
              .map((d: NodeGroupInfo) => `${d.name}:${d.status}`)
              .join(', ');
            this.log.status(elapsed, interval, `NodeGroups: ${line}`);
          }
        },
        onSuccess: () => {
          this.log.pass('All node groups are ACTIVE');
        },
        onFailure: (r) => {
          this.log.fail(`NodeGroup ${r.failedNg?.name} status: ${r.failedNg?.status}`);
          r.failedNg?.healthIssues?.forEach((issue: { code: string; message: string }) => {
            console.log(c.red(`    ${issue.code}: ${issue.message}`));
          });
        },
      }
    );

    return {
      success: result.success,
      details: lastDetails,
      failedNodeGroup: result.failedNg,
      reason: result.reason,
    };
  }
}
