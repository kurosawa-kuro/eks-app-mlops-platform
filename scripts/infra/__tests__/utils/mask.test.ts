/**
 * Tests for mask utility functions
 */
import { describe, it, expect } from 'vitest';
import { isJson, maskPassword, maskToken, maskSecretValue } from '../../framework/utils/mask.js';

describe('isJson', () => {
  it('returns true for valid JSON', () => {
    expect(isJson('{}')).toBe(true);
    expect(isJson('{"key": "value"}')).toBe(true);
    expect(isJson('[]')).toBe(true);
    expect(isJson('"string"')).toBe(true);
    expect(isJson('123')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(isJson('not json')).toBe(false);
    expect(isJson('{key: value}')).toBe(false);
    expect(isJson('')).toBe(false);
  });
});

describe('maskPassword', () => {
  it('masks password in connection strings', () => {
    expect(maskPassword('postgres://user:secret123@localhost:5432/db'))
      .toBe('postgres://user:****@localhost:5432/db');
  });

  it('handles strings without passwords', () => {
    expect(maskPassword('no-password-here')).toBe('no-password-here');
  });
});

describe('maskToken', () => {
  it('masks Discord webhook tokens', () => {
    expect(maskToken('https://discord.com/api/webhooks/123456789/abcdefgh'))
      .toBe('https://discord.com/api/webhooks/123456789/****');
  });

  it('handles strings without tokens', () => {
    expect(maskToken('no-token-here')).toBe('no-token-here');
  });
});

describe('maskSecretValue', () => {
  it('masks null/undefined values', () => {
    expect(maskSecretValue(null)).toBe('****');
    expect(maskSecretValue(undefined)).toBe('****');
  });

  it('masks short strings completely', () => {
    expect(maskSecretValue('short')).toBe('****');
  });

  it('masks long strings with prefix/suffix', () => {
    expect(maskSecretValue('this-is-a-longer-secret')).toBe('this****cret');
  });

  it('masks JSON values by key', () => {
    const json = JSON.stringify({ username: 'admin', password: 'secret' });
    const masked = maskSecretValue(json);
    expect(masked).toContain('username: ****');
    expect(masked).toContain('password: ****');
  });
});
