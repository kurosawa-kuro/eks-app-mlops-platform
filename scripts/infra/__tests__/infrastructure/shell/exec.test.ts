/**
 * Tests for core/exec.ts - Command execution utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run, aws, sleep, runStreaming } from '../../../infrastructure/shell/index.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

import { execSync, spawn } from 'child_process';

const mockExecSync = vi.mocked(execSync);
const mockSpawn = vi.mocked(spawn);

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes command and returns trimmed output', () => {
    mockExecSync.mockReturnValue('  output  \n');
    const result = run('echo test');
    expect(result).toBe('output');
    expect(mockExecSync).toHaveBeenCalledWith('echo test', expect.objectContaining({
      encoding: 'utf8',
    }));
  });

  it('uses provided cwd option', () => {
    mockExecSync.mockReturnValue('output');
    run('ls', { cwd: '/tmp' });
    expect(mockExecSync).toHaveBeenCalledWith('ls', expect.objectContaining({
      cwd: '/tmp',
    }));
  });

  it('uses silent mode with pipe stdio', () => {
    mockExecSync.mockReturnValue('output');
    run('ls', { silent: true });
    expect(mockExecSync).toHaveBeenCalledWith('ls', expect.objectContaining({
      stdio: 'pipe',
    }));
  });

  it('merges custom env variables', () => {
    mockExecSync.mockReturnValue('output');
    run('echo $FOO', { env: { FOO: 'bar' } });
    expect(mockExecSync).toHaveBeenCalledWith('echo $FOO', expect.objectContaining({
      env: expect.objectContaining({ FOO: 'bar' }),
    }));
  });

  it('returns empty string when ignoreError is true', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });
    const result = run('bad-command', { ignoreError: true });
    expect(result).toBe('');
  });

  it('throws error by default on failure', () => {
    mockExecSync.mockImplementation(() => {
      const error = new Error('Command failed') as Error & { stderr: Buffer };
      error.stderr = Buffer.from('error message');
      throw error;
    });
    expect(() => run('bad-command')).toThrow('error message');
  });

  it('returns RunResult when throwOnError is false', () => {
    mockExecSync.mockReturnValue('success output');
    const result = run('echo test', { throwOnError: false });
    expect(result).toEqual({ success: true, output: 'success output' });
  });

  it('returns failure RunResult when throwOnError is false and command fails', () => {
    mockExecSync.mockImplementation(() => {
      const error = new Error('Command failed') as Error & { stdout: Buffer; stderr: Buffer };
      error.stdout = Buffer.from('stdout content');
      error.stderr = Buffer.from('stderr content');
      throw error;
    });
    const result = run('bad-command', { throwOnError: false });
    expect(result).toEqual({
      success: false,
      output: 'stdout content',
      stderr: 'stderr content',
      error: expect.any(Error),
    });
  });

  it('uses default timeout of 60000ms', () => {
    mockExecSync.mockReturnValue('output');
    run('echo test');
    expect(mockExecSync).toHaveBeenCalledWith('echo test', expect.objectContaining({
      timeout: 60000,
    }));
  });

  it('uses custom timeout', () => {
    mockExecSync.mockReturnValue('output');
    run('echo test', { timeout: 30000 });
    expect(mockExecSync).toHaveBeenCalledWith('echo test', expect.objectContaining({
      timeout: 30000,
    }));
  });
});

describe('aws', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AWS_REGION;
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
  });

  it('adds default region when not specified', () => {
    mockExecSync.mockReturnValue('output');
    aws('s3 ls');
    expect(mockExecSync).toHaveBeenCalledWith(
      'aws s3 ls --region ap-northeast-1',
      expect.any(Object)
    );
  });

  it('uses AWS_REGION environment variable', () => {
    process.env.AWS_REGION = 'us-west-2';
    mockExecSync.mockReturnValue('output');
    aws('s3 ls');
    expect(mockExecSync).toHaveBeenCalledWith(
      'aws s3 ls --region us-west-2',
      expect.any(Object)
    );
  });

  it('uses region from options', () => {
    mockExecSync.mockReturnValue('output');
    aws('s3 ls', { region: 'eu-west-1' });
    expect(mockExecSync).toHaveBeenCalledWith(
      'aws s3 ls --region eu-west-1',
      expect.any(Object)
    );
  });

  it('does not add region if already present in args', () => {
    mockExecSync.mockReturnValue('output');
    aws('s3 ls --region us-east-1');
    expect(mockExecSync).toHaveBeenCalledWith(
      'aws s3 ls --region us-east-1',
      expect.any(Object)
    );
  });

  it('returns RunResult when throwOnError is false', () => {
    mockExecSync.mockReturnValue('success');
    const result = aws('s3 ls', { throwOnError: false });
    expect(result).toEqual({ success: true, output: 'success' });
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after specified milliseconds', async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('does not resolve before timeout', async () => {
    let resolved = false;
    sleep(1000).then(() => { resolved = true; });
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});

describe('runStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns process with correct arguments', async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      }),
      kill: vi.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc as never);

    await runStreaming('kubectl', ['get', 'pods'], '/tmp');

    expect(mockSpawn).toHaveBeenCalledWith('kubectl', ['get', 'pods'], {
      cwd: '/tmp',
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });
  });

  it('uses shell option when specified', async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      }),
      kill: vi.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc as never);

    await runStreaming('echo', ['hello'], '/tmp', { shell: true });

    expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], expect.objectContaining({
      shell: true,
    }));
  });

  it('resolves with stdout and stderr on success', async () => {
    const mockProc = {
      stdout: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') cb(Buffer.from('stdout data'));
        }),
      },
      stderr: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') cb(Buffer.from('stderr data'));
        }),
      },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      }),
      kill: vi.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc as never);

    const result = await runStreaming('echo', ['test'], '/tmp');

    expect(result).toEqual({
      stdout: 'stdout data',
      stderr: 'stderr data',
      code: 0,
    });
  });

  it('rejects on non-zero exit code', async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(1), 0);
      }),
      kill: vi.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc as never);

    await expect(runStreaming('bad-cmd', [], '/tmp')).rejects.toThrow('Exit code 1');
  });

  it('rejects on spawn error', async () => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (err: Error) => void) => {
        if (event === 'error') setTimeout(() => cb(new Error('spawn error')), 0);
      }),
      kill: vi.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc as never);

    await expect(runStreaming('nonexistent', [], '/tmp')).rejects.toThrow('spawn error');
  });
});
