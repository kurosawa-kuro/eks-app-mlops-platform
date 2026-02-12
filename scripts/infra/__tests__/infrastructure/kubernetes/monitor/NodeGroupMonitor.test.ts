/**
 * Tests for kubernetes/monitors/NodeGroupMonitor.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../infrastructure/shell/index.js', () => ({
  aws: vi.fn(),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../framework/logging/index.js', () => ({
  log: {
    info: vi.fn(),
    fail: vi.fn(),
    pass: vi.fn(),
    status: vi.fn(),
  },
}));

vi.mock('../../../../framework/logging/colors.js', () => ({
  c: {
    red: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import { aws } from '../../../../infrastructure/shell/index.js';
import { NodeGroupMonitor } from '../../../../infrastructure/kubernetes/monitor/NodeGroupMonitor.js';
import type { Mock } from 'vitest';

const mockAws = aws as unknown as Mock;

describe('NodeGroupMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('creates monitor with config', () => {
      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 600000,
        intervalSec: 30,
        region: 'us-east-1',
      });
      expect(monitor).toBeDefined();
    });
  });

  describe('listNodeGroups', () => {
    it('returns list of node groups', () => {
      mockAws.mockReturnValue({
        success: true,
        output: JSON.stringify({ nodegroups: ['ng-1', 'ng-2'] }),
      });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = monitor.listNodeGroups();

      expect(result).toEqual(['ng-1', 'ng-2']);
    });

    it('returns empty array on error', () => {
      mockAws.mockReturnValue({ success: false, output: '', stderr: 'error' });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      expect(monitor.listNodeGroups()).toEqual([]);
    });
  });

  describe('describeNodeGroup', () => {
    it('returns node group info', () => {
      mockAws.mockReturnValue({
        success: true,
        output: JSON.stringify({
          nodegroup: {
            nodegroupName: 'ng-1',
            status: 'ACTIVE',
            scalingConfig: { desiredSize: 2 },
            resources: { autoScalingGroups: [{ name: 'asg-1' }] },
            health: { issues: [] },
          },
        }),
      });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = monitor.describeNodeGroup('ng-1');

      expect(result).toEqual({
        name: 'ng-1',
        status: 'ACTIVE',
        desiredSize: 2,
        asgName: 'asg-1',
        healthIssues: [],
      });
    });

    it('returns null on error', () => {
      mockAws.mockReturnValue({ success: false, output: '', stderr: 'error' });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      expect(monitor.describeNodeGroup('ng-1')).toBeNull();
    });
  });

  describe('waitForActive', () => {
    it('returns success when all node groups are active', async () => {
      // List node groups
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({ nodegroups: ['ng-1'] }),
      });
      // Describe node group
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          nodegroup: {
            nodegroupName: 'ng-1',
            status: 'ACTIVE',
            scalingConfig: { desiredSize: 2 },
            health: { issues: [] },
          },
        }),
      });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForActive();

      expect(result.success).toBe(true);
      expect(result.details).toHaveLength(1);
    });

    it('returns failure when node group fails', async () => {
      // List node groups
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({ nodegroups: ['ng-1'] }),
      });
      // Describe node group - failed status
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          nodegroup: {
            nodegroupName: 'ng-1',
            status: 'CREATE_FAILED',
            health: { issues: [{ code: 'EC2SecurityGroupNotFound', message: 'SG not found' }] },
          },
        }),
      });

      const monitor = new NodeGroupMonitor({
        clusterName: 'my-cluster',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForActive();

      expect(result.success).toBe(false);
      expect(result.failedNodeGroup?.name).toBe('ng-1');
    });
  });
});
