/**
 * Tests for classes/PreflightChecker.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

vi.mock('../../../infrastructure/shell/index.js', () => ({
  run: vi.fn(),
}));

vi.mock('../../../framework/logging/colors.js', () => ({
  c: {
    green: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

import { execSync } from 'child_process';
import * as fs from 'fs';
import { run } from '../../../infrastructure/shell/index.js';
import { PreflightChecker } from '../../../framework/lifecycle/PreflightChecker.js';

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockRun = vi.mocked(run);

describe('PreflightChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('check', () => {
    it('returns value on success', () => {
      const checker = new PreflightChecker();
      const result = checker.check('Test', () => ({ ok: true, value: 'test-value' }));
      expect(result).toBe('test-value');
    });

    it('returns null on failure', () => {
      const checker = new PreflightChecker();
      const result = checker.check('Test', () => ({ ok: false, detail: 'failed' }));
      expect(result).toBeNull();
    });
  });

  describe('checkCommand', () => {
    it('returns true when command exists', () => {
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/kubectl'));

      const checker = new PreflightChecker();
      const result = checker.checkCommand('kubectl');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('command -v kubectl', { stdio: 'pipe' });
    });

    it('returns null when command not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const checker = new PreflightChecker();
      const result = checker.checkCommand('nonexistent');

      expect(result).toBeNull();
    });

    it('uses custom install hint', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const checker = new PreflightChecker();
      checker.checkCommand('helm', 'Install Helm from https://helm.sh');

      // Verify hint is used (logged to console)
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('checkAwsCli', () => {
    it('returns true when AWS CLI is installed', () => {
      mockRun.mockReturnValue('/usr/local/bin/aws');

      const checker = new PreflightChecker();
      const result = checker.checkAwsCli();

      expect(result).toBe(true);
    });

    it('returns null when AWS CLI not found', () => {
      mockRun.mockImplementation(() => {
        throw new Error('Not found');
      });

      const checker = new PreflightChecker();
      const result = checker.checkAwsCli();

      expect(result).toBeNull();
    });
  });

  describe('checkAwsCredentials', () => {
    it('returns true with valid credentials', () => {
      mockRun.mockReturnValue('123456789012');

      const checker = new PreflightChecker();
      const result = checker.checkAwsCredentials();

      expect(result).toBe(true);
    });

    it('returns null with expired token', () => {
      mockRun.mockImplementation(() => {
        throw new Error('ExpiredToken: The security token included in the request is expired');
      });

      const checker = new PreflightChecker();
      const result = checker.checkAwsCredentials();

      expect(result).toBeNull();
    });

    it('returns null with invalid credentials', () => {
      mockRun.mockImplementation(() => {
        throw new Error('InvalidClientTokenId: The security token is invalid');
      });

      const checker = new PreflightChecker();
      const result = checker.checkAwsCredentials();

      expect(result).toBeNull();
    });
  });

  describe('checkPath', () => {
    it('returns true when path exists', () => {
      mockExistsSync.mockReturnValue(true);

      const checker = new PreflightChecker();
      const result = checker.checkPath('Check config', '/path/to/config');

      expect(result).toBe(true);
    });

    it('returns null when path does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const checker = new PreflightChecker();
      const result = checker.checkPath('Check config', '/nonexistent');

      expect(result).toBeNull();
    });
  });
});
