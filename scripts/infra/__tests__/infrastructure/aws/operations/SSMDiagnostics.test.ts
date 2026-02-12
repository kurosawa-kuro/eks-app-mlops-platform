import { describe, it, expect } from 'vitest';
import {
  SSMDiagnostics,
  SSMDiagnosticsUtils,
  SSM_ERROR_PATTERNS,
  SSM_DIAG_COMMANDS,
} from '../../../../infrastructure/aws/operations/SSMDiagnostics.js';

describe('SSMDiagnostics', () => {
  describe('SSM_ERROR_PATTERNS', () => {
    it('should contain expected patterns', () => {
      expect(SSM_ERROR_PATTERNS.length).toBeGreaterThan(0);
      expect(SSM_ERROR_PATTERNS.some(p => p.test('failed to start kubelet'))).toBe(true);
      expect(SSM_ERROR_PATTERNS.some(p => p.test('error joining cluster'))).toBe(true);
      expect(SSM_ERROR_PATTERNS.some(p => p.test('bootstrap failed'))).toBe(true);
    });
  });

  describe('SSM_DIAG_COMMANDS', () => {
    it('should contain expected commands', () => {
      expect(SSM_DIAG_COMMANDS.length).toBeGreaterThan(0);
      expect(SSM_DIAG_COMMANDS.some(c => c.includes('kubelet'))).toBe(true);
      expect(SSM_DIAG_COMMANDS.some(c => c.includes('cloud-init'))).toBe(true);
    });
  });

  describe('checkErrors', () => {
    it('should detect error patterns', () => {
      const diagnostics = new SSMDiagnostics();
      const result = diagnostics.checkErrors('failed to start kubelet\nnode not ready');

      expect(result.hasError).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return no errors for clean output', () => {
      const diagnostics = new SSMDiagnostics();
      const result = diagnostics.checkErrors('kubelet is running\nnode is ready');

      expect(result.hasError).toBe(false);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty input', () => {
      const diagnostics = new SSMDiagnostics();
      const result = diagnostics.checkErrors('');

      expect(result.hasError).toBe(false);
      expect(result.errors).toEqual([]);
    });

    it('should limit errors to 10', () => {
      const diagnostics = new SSMDiagnostics();
      const lines = Array(15).fill('failed to start kubelet').join('\n');
      const result = diagnostics.checkErrors(lines);

      expect(result.hasError).toBe(true);
      expect(result.errors.length).toBe(10);
    });
  });

  describe('extractStatus', () => {
    it('should extract status from log content', () => {
      const diagnostics = new SSMDiagnostics();
      const result = diagnostics.extractStatus('Active: active (running)', /Active:\s*(\S+)/);

      expect(result).toBe('active');
    });

    it('should return unknown for no match', () => {
      const diagnostics = new SSMDiagnostics();
      const result = diagnostics.extractStatus('no match here', /Active:\s*(\S+)/);

      expect(result).toBe('unknown');
    });
  });

  describe('custom error patterns', () => {
    it('should use custom patterns when provided', () => {
      const customPatterns = [/custom error/i];
      const diagnostics = new SSMDiagnostics({ errorPatterns: customPatterns });

      const result = diagnostics.checkErrors('This is a custom error message');

      expect(result.hasError).toBe(true);
    });

    it('should not match default patterns with custom config', () => {
      const customPatterns = [/custom error/i];
      const diagnostics = new SSMDiagnostics({ errorPatterns: customPatterns });

      const result = diagnostics.checkErrors('failed to start kubelet');

      expect(result.hasError).toBe(false);
    });
  });
});

describe('SSMDiagnosticsUtils', () => {
  describe('checkErrors', () => {
    it('should detect error patterns', () => {
      const result = SSMDiagnosticsUtils.checkErrors('node not ready\nerror');

      expect(result.hasError).toBe(true);
    });

    it('should return no errors for clean output', () => {
      const result = SSMDiagnosticsUtils.checkErrors('all good');

      expect(result.hasError).toBe(false);
    });
  });

  describe('extractStatus', () => {
    it('should extract status', () => {
      const result = SSMDiagnosticsUtils.extractStatus('status: done', /status:\s*(\S+)/);

      expect(result).toBe('done');
    });
  });
});
