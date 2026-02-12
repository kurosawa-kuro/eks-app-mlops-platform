/**
 * Tests for format utility functions
 */
import { describe, it, expect } from 'vitest';
import { formatBytes, formatDate } from '../../framework/utils/format.js';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(512)).toBe('512 bytes');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('handles decimal places', () => {
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(2621440)).toBe('2.50 MB');
  });
});

describe('formatDate', () => {
  it('formats date strings correctly', () => {
    expect(formatDate('2024-01-15T12:30:00Z')).toBe('2024-01-15');
    expect(formatDate(new Date('2024-06-20'))).toBe('2024-06-20');
  });

  it('returns N/A for invalid inputs', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
    expect(formatDate('')).toBe('N/A');
  });
});
