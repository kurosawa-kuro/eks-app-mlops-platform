/**
 * Tests for validation utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  validateResourceName,
  validateInstanceId,
  validatePort,
  validateOverlayName,
  validateStepArg,
  validateCommand,
  escapeSedReplacement,
} from '../../framework/utils/validation.js';

describe('validateResourceName', () => {
  it('accepts valid resource names', () => {
    expect(validateResourceName('my-resource')).toBe('my-resource');
    expect(validateResourceName('my_resource_123')).toBe('my_resource_123');
    expect(validateResourceName('resource.name')).toBe('resource.name');
    expect(validateResourceName('path/to/resource')).toBe('path/to/resource');
  });

  it('rejects invalid resource names', () => {
    expect(() => validateResourceName('my resource')).toThrow('Only alphanumeric');
    expect(() => validateResourceName('resource$name')).toThrow('Only alphanumeric');
    expect(() => validateResourceName('../path')).toThrow('Path traversal');
    expect(() => validateResourceName(null)).toThrow('required');
    expect(() => validateResourceName(undefined)).toThrow('required');
  });

  it('uses custom resource type in error message', () => {
    expect(() => validateResourceName('bad name', 'S3 bucket'))
      .toThrow('S3 bucket name');
  });
});

describe('validateInstanceId', () => {
  it('accepts valid instance IDs', () => {
    expect(validateInstanceId('i-1234567890abcdef0')).toBe('i-1234567890abcdef0');
    expect(validateInstanceId('i-12345678')).toBe('i-12345678');
  });

  it('rejects invalid instance IDs', () => {
    expect(() => validateInstanceId('invalid')).toThrow('Invalid instance ID');
    expect(() => validateInstanceId('i-xyz')).toThrow('Invalid instance ID');
    expect(() => validateInstanceId(null)).toThrow('required');
  });
});

describe('validatePort', () => {
  it('accepts valid ports', () => {
    expect(validatePort(80)).toBe('80');
    expect(validatePort('443')).toBe('443');
    expect(validatePort(1)).toBe('1');
    expect(validatePort(65535)).toBe('65535');
  });

  it('rejects invalid ports', () => {
    expect(() => validatePort(0)).toThrow('Invalid');
    expect(() => validatePort(65536)).toThrow('Invalid');
    expect(() => validatePort('abc')).toThrow('Invalid');
    expect(() => validatePort(null)).toThrow('Invalid');
  });
});

describe('validateOverlayName', () => {
  it('accepts valid overlay names', () => {
    expect(validateOverlayName('prod')).toBe('prod');
    expect(validateOverlayName('staging')).toBe('staging');
    expect(validateOverlayName('my-overlay-1')).toBe('my-overlay-1');
  });

  it('rejects invalid overlay names', () => {
    expect(() => validateOverlayName('my overlay')).toThrow('Only alphanumeric');
    expect(() => validateOverlayName('overlay_name')).toThrow('Only alphanumeric');
    expect(() => validateOverlayName(null)).toThrow('required');
  });
});

describe('validateStepArg', () => {
  it('accepts valid step arguments', () => {
    expect(validateStepArg('all')).toBe('all');
    expect(validateStepArg('status')).toBe('status');
    expect(validateStepArg('step-1')).toBe('step-1');
  });

  it('rejects invalid step arguments', () => {
    expect(() => validateStepArg('step name')).toThrow('Only alphanumeric');
    expect(() => validateStepArg(null)).toThrow('required');
  });
});

describe('validateCommand', () => {
  it('accepts safe commands', () => {
    expect(validateCommand('ls -la')).toBe('ls -la');
    expect(validateCommand('kubectl get pods')).toBe('kubectl get pods');
  });

  it('rejects dangerous commands', () => {
    expect(() => validateCommand('; rm -rf /')).toThrow('dangerous');
    expect(() => validateCommand('echo `whoami`')).toThrow('dangerous');
    expect(() => validateCommand('echo $(id)')).toThrow('dangerous');
    expect(() => validateCommand('cat file | sh')).toThrow('dangerous');
  });
});

describe('escapeSedReplacement', () => {
  it('escapes special characters', () => {
    expect(escapeSedReplacement('hello/world')).toBe('hello\\/world');
    expect(escapeSedReplacement('a&b')).toBe('a\\&b');
    expect(escapeSedReplacement('a#b')).toBe('a\\#b');
    expect(escapeSedReplacement('a\\b')).toBe('a\\\\b');
  });

  it('handles null/undefined', () => {
    expect(escapeSedReplacement(null)).toBe('');
    expect(escapeSedReplacement(undefined)).toBe('');
  });
});
