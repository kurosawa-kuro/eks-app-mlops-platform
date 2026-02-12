/**
 * Tests for kubernetes/monitors/BastionMonitor.ts
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
    warn: vi.fn(),
    status: vi.fn(),
  },
}));

vi.mock('../../../../framework/logging/colors.js', () => ({
  c: {
    yellow: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
  },
}));

vi.mock('../../../../infrastructure/aws/runtime/SSMCommandRunner.js', () => ({
  ssmGetInstanceStatus: vi.fn(),
}));

import { aws } from '../../../../infrastructure/shell/index.js';
import { ssmGetInstanceStatus } from '../../../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { BastionMonitor } from '../../../../infrastructure/kubernetes/monitor/BastionMonitor.js';
import type { Mock } from 'vitest';

const mockAws = aws as unknown as Mock;
const mockSsmGetInstanceStatus = vi.mocked(ssmGetInstanceStatus);

describe('BastionMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('creates monitor with config', () => {
      const monitor = new BastionMonitor({
        instanceId: 'i-12345678',
        timeoutMs: 300000,
        intervalSec: 10,
        region: 'us-east-1',
      });
      expect(monitor).toBeDefined();
    });
  });

  describe('waitForSSMOnline', () => {
    it('returns INSTANCE_NOT_FOUND when instance does not exist', async () => {
      mockAws.mockReturnValue({ success: false, output: '', stderr: '' });

      const monitor = new BastionMonitor({
        instanceId: 'i-nonexistent',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForSSMOnline();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSTANCE_NOT_FOUND');
    });

    it('returns MINIMAL_AMI when minimal AMI detected', async () => {
      // Instance info
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          State: { Name: 'running' },
          InstanceType: 't3.micro',
          PrivateIpAddress: '10.0.0.1',
          ImageId: 'ami-12345',
        }),
      });
      // AMI info with minimal
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          Name: 'amzn2-ami-minimal-hvm-2.0',
        }),
      });

      const monitor = new BastionMonitor({
        instanceId: 'i-12345678',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForSSMOnline();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('MINIMAL_AMI');
    });

    it('returns INSTANCE_NOT_RUNNING when instance is stopped', async () => {
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          State: { Name: 'stopped' },
          InstanceType: 't3.micro',
          PrivateIpAddress: '10.0.0.1',
        }),
      });

      const monitor = new BastionMonitor({
        instanceId: 'i-12345678',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForSSMOnline();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSTANCE_NOT_RUNNING');
    });

    it('returns success when SSM comes online', async () => {
      // Instance info
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          State: { Name: 'running' },
          InstanceType: 't3.micro',
          PrivateIpAddress: '10.0.0.1',
          ImageId: 'ami-12345',
        }),
      });
      // AMI info (not minimal)
      mockAws.mockReturnValueOnce({
        success: true,
        output: JSON.stringify({
          Name: 'amzn2-ami-hvm-2.0',
        }),
      });

      // SSM status check
      mockSsmGetInstanceStatus.mockReturnValue({
        status: 'Online',
        details: { agentVersion: '3.2.1' },
      });

      const monitor = new BastionMonitor({
        instanceId: 'i-12345678',
        timeoutMs: 5000,
        intervalSec: 1,
        region: 'us-east-1',
      });

      const result = await monitor.waitForSSMOnline();

      expect(result.success).toBe(true);
      expect(result.agentVersion).toBe('3.2.1');
    });
  });
});
