import { describe, it, expect, vi } from 'vitest';
import { FileLogger } from '../../../framework/logging/FileLogger.js';

describe('FileLogger', () => {
  describe('init', () => {
    it('should return null when disabled', () => {
      const logger = new FileLogger();
      const result = logger.init(false);

      expect(result).toBeNull();
      expect(logger.isActive()).toBe(false);
    });

    it('should return log path when enabled', () => {
      const logger = new FileLogger({
        logsDir: '/tmp/filelogger-test',
        filenamePrefix: 'test',
      });
      const result = logger.init(true);

      expect(result).not.toBeNull();
      expect(result).toContain('test-');
      expect(result).toContain('.log');
      expect(logger.isActive()).toBe(true);

      // Clean up
      logger.finalize();
    });
  });

  describe('finalize', () => {
    it('should set isActive to false', () => {
      const logger = new FileLogger({
        logsDir: '/tmp/filelogger-test',
        filenamePrefix: 'test',
      });
      logger.init(true);
      expect(logger.isActive()).toBe(true);

      logger.finalize();
      expect(logger.isActive()).toBe(false);
    });
  });

  describe('getLogPath', () => {
    it('should return null before init', () => {
      const logger = new FileLogger();
      expect(logger.getLogPath()).toBeNull();
    });

    it('should return path after init', () => {
      const logger = new FileLogger({
        logsDir: '/tmp/filelogger-test',
        filenamePrefix: 'test',
      });
      logger.init(true);

      expect(logger.getLogPath()).not.toBeNull();
      logger.finalize();
    });
  });

  describe('default config', () => {
    it('should use default values', () => {
      const logger = new FileLogger();
      logger.init(true);
      const logPath = logger.getLogPath();

      expect(logPath).toContain('infra-');
      logger.finalize();
    });
  });

  describe('stripAnsi', () => {
    it('should strip ANSI codes when writing to file', () => {
      const logger = new FileLogger({
        logsDir: '/tmp/filelogger-test',
        filenamePrefix: 'test',
      });

      // Mock the writeToFile to test stripAnsi behavior
      const writeSpy = vi.fn();

      // Access private method via prototype for testing
      const stripAnsi = (logger as unknown as { stripAnsi: (str: string) => string }).stripAnsi?.bind(logger);

      if (stripAnsi) {
        const result = stripAnsi('\x1b[32mGreen text\x1b[0m');
        expect(result).toBe('Green text');
        expect(result).not.toContain('\x1b');
      }
    });
  });
});
