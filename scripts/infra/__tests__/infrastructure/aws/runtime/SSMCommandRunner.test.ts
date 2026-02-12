/**
 * Tests for classes/SSMCommandRunner.ts
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
    debug: vi.fn(),
  },
}));

vi.mock('../../../../framework/logging/colors.js', () => ({
  c: {
    cyan: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock('../../../../infrastructure/aws/core.js', () => ({
  awsGetRegion: vi.fn().mockReturnValue('ap-northeast-1'),
}));

import { aws, sleep } from '../../../../infrastructure/shell/index.js';
import { SSMCommandRunner, ssmGetInstanceStatus } from '../../../../infrastructure/aws/runtime/SSMCommandRunner.js';

const mockAws = vi.mocked(aws);
const mockSleep = vi.mocked(sleep);

describe('SSMCommandRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  describe('constructor', () => {
    it('uses provided instanceId and region', () => {
      const runner = new SSMCommandRunner('i-12345678', 'us-west-2');
      expect(runner.instanceId).toBe('i-12345678');
      expect(runner.region).toBe('us-west-2');
    });

    it('uses default region when not provided', () => {
      const runner = new SSMCommandRunner('i-12345678');
      expect(runner.region).toBe('ap-northeast-1');
    });
  });

  describe('execute', () => {
    it('sends command and returns success on completion', async () => {
      const runner = new SSMCommandRunner('i-12345678', 'us-east-1');

      // Mock _sendCommand return
      mockAws
        .mockReturnValueOnce('cmd-abc123') // send-command
        .mockReturnValue('Success'); // get-command-invocation status

      const result = await runner.execute('echo hello', { stream: false });

      expect(result.success).toBe(true);
      expect(mockAws).toHaveBeenCalledWith(
        expect.stringContaining('ssm send-command'),
        expect.objectContaining({ region: 'us-east-1' })
      );
    });

    it('returns failure when send command fails', async () => {
      const runner = new SSMCommandRunner('i-12345678');

      mockAws.mockImplementation(() => {
        throw new Error('SSM not available');
      });

      const result = await runner.execute('echo test', { stream: false });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send command');
    });

    it('returns failure status when command fails', async () => {
      const runner = new SSMCommandRunner('i-12345678');

      mockAws
        .mockReturnValueOnce('cmd-abc123') // send-command
        .mockReturnValueOnce('Failed') // status check
        .mockReturnValue('error output'); // get error

      const result = await runner.execute('bad-command', { stream: false });

      expect(result.success).toBe(false);
      expect(result.status).toBe('Failed');
    });

    it('polls until completion', async () => {
      const runner = new SSMCommandRunner('i-12345678');

      mockAws
        .mockReturnValueOnce('cmd-abc123') // send-command
        .mockReturnValueOnce('InProgress') // first poll
        .mockReturnValueOnce('InProgress') // second poll
        .mockReturnValueOnce('Success') // third poll - success
        .mockReturnValue('output'); // get output

      const result = await runner.execute('slow-command', { timeout: 60, stream: false });

      expect(result.success).toBe(true);
      expect(mockSleep).toHaveBeenCalled();
    });

    it('times out after max iterations', async () => {
      const runner = new SSMCommandRunner('i-12345678');

      mockAws
        .mockReturnValueOnce('cmd-abc123') // send-command
        .mockReturnValue('InProgress'); // always in progress

      const result = await runner.execute('hanging-command', { timeout: 2, stream: false });

      expect(result.success).toBe(false);
      expect(result.status).toBe('Timeout');
    });
  });

  describe('_sendCommand', () => {
    it('sends command with correct parameters', () => {
      const runner = new SSMCommandRunner('i-12345678', 'us-west-2');
      mockAws.mockReturnValue('cmd-123');

      const commandId = runner._sendCommand('echo hello\necho world');

      expect(commandId).toBe('cmd-123');
      expect(mockAws).toHaveBeenCalledWith(
        expect.stringContaining('ssm send-command --instance-ids i-12345678'),
        expect.objectContaining({ region: 'us-west-2' })
      );
    });

    it('returns null on error', () => {
      const runner = new SSMCommandRunner('i-12345678');
      mockAws.mockImplementation(() => {
        throw new Error('SSM error');
      });

      const commandId = runner._sendCommand('echo test');

      expect(commandId).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('returns instance ping status', () => {
      const runner = new SSMCommandRunner('i-12345678');
      mockAws.mockReturnValue('Online');

      const status = runner.getStatus();

      expect(status).toBe('Online');
      expect(mockAws).toHaveBeenCalledWith(
        expect.stringContaining('ssm describe-instance-information'),
        expect.objectContaining({ ignoreError: true })
      );
    });

    it('returns None when status unavailable', () => {
      const runner = new SSMCommandRunner('i-12345678');
      mockAws.mockReturnValue('');

      const status = runner.getStatus();

      expect(status).toBe('None');
    });
  });
});

describe('ssmGetInstanceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns NO_INSTANCE for empty instanceId', () => {
    const result = ssmGetInstanceStatus('');

    expect(result.status).toBe('NO_INSTANCE');
    expect(result.details).toBeNull();
  });

  it('returns NOT_CONNECTED when no result', () => {
    mockAws.mockReturnValue('');

    const result = ssmGetInstanceStatus('i-12345678');

    expect(result.status).toBe('NOT_CONNECTED');
    expect(result.details).toBeNull();
  });

  it('returns instance details when connected', () => {
    const instanceInfo = {
      InstanceInformationList: [
        {
          PingStatus: 'Online',
          AgentVersion: '3.2.1',
          PlatformName: 'Amazon Linux',
        },
      ],
    };
    mockAws.mockReturnValue(JSON.stringify(instanceInfo));

    const result = ssmGetInstanceStatus('i-12345678');

    expect(result.status).toBe('Online');
    expect(result.details).toEqual({
      agentVersion: '3.2.1',
      platformName: 'Amazon Linux',
    });
  });

  it('uses provided region', () => {
    mockAws.mockReturnValue('');

    ssmGetInstanceStatus('i-12345678', 'eu-west-1');

    expect(mockAws).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ region: 'eu-west-1' })
    );
  });
});
