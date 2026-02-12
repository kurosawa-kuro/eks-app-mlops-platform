/**
 * Tests for classes/HTTPSVerifier.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../infrastructure/shell/index.js', () => ({
  run: vi.fn(),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../framework/logging/index.js', () => ({
  log: {
    info: vi.fn(),
    pass: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../framework/logging/colors.js', () => ({
  c: {
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
  },
  colors: {
    reset: '',
    bold: '',
    dim: '',
    red: '',
    green: '',
    yellow: '',
    blue: '',
    magenta: '',
    cyan: '',
  },
}));

import { run, sleep } from '../../../infrastructure/shell/index.js';
import { HTTPSVerifier } from '../../../framework/lifecycle/HTTPSVerifier.js';

const mockRun = vi.mocked(run);
const mockSleep = vi.mocked(sleep);

describe('HTTPSVerifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('creates verifier with API URL', () => {
      const verifier = new HTTPSVerifier('https://api.example.com');
      expect(verifier.apiUrl).toBe('https://api.example.com');
    });
  });

  describe('verify', () => {
    it('returns true when URL is empty', async () => {
      const verifier = new HTTPSVerifier('');
      const result = await verifier.verify();
      expect(result).toBe(true);
    });

    it('returns true on successful health check', async () => {
      mockRun.mockReturnValue('{"status":"ok"}');

      const verifier = new HTTPSVerifier('https://api.example.com');
      const result = await verifier.verify();

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('curl'),
      );
    });

    it('returns true on non-JSON response', async () => {
      mockRun.mockReturnValue('OK');

      const verifier = new HTTPSVerifier('https://api.example.com');
      const result = await verifier.verify();

      expect(result).toBe(true);
    });

    it('retries on failure and succeeds', async () => {
      mockRun
        .mockImplementationOnce(() => { throw new Error('Connection refused'); })
        .mockImplementationOnce(() => { throw new Error('Connection refused'); })
        .mockReturnValue('{"status":"ok"}');

      const verifier = new HTTPSVerifier('https://api.example.com');
      const result = await verifier.verify(5, 1);

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2);
    });

    it('returns false after max retries', async () => {
      mockRun.mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const verifier = new HTTPSVerifier('https://api.example.com');
      const result = await verifier.verify(3, 1);

      expect(result).toBe(false);
      expect(mockRun).toHaveBeenCalledTimes(3);
    });

    it('calls health endpoint', async () => {
      mockRun.mockReturnValue('OK');

      const verifier = new HTTPSVerifier('https://api.example.com');
      await verifier.verify();

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('https://api.example.com/health'),
      );
    });
  });
});
