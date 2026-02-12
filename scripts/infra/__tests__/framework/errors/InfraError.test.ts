/**
 * Tests for InfraError class
 */
import { describe, it, expect } from 'vitest';
import { InfraError } from '../../../framework/errors/InfraError.js';

describe('InfraError', () => {
  it('creates error with message and context', () => {
    const error = new InfraError('Test error', {
      region: 'ap-northeast-1',
      cluster: 'my-cluster',
    });
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('InfraError');
    expect(error.context.region).toBe('ap-northeast-1');
    expect(error.context.cluster).toBe('my-cluster');
  });

  it('creates error without context', () => {
    const error = new InfraError('Simple error');
    expect(error.message).toBe('Simple error');
    expect(error.context).toEqual({});
  });

  describe('InfraError.from', () => {
    it('converts regular Error', () => {
      const original = new Error('Original error');
      const infraError = InfraError.from(original, { operation: 'test' });
      expect(infraError.message).toBe('Original error');
      expect(infraError.context.operation).toBe('test');
    });

    it('merges context from existing InfraError', () => {
      const original = new InfraError('Original', { region: 'us-east-1' });
      const merged = InfraError.from(original, { cluster: 'new-cluster' });
      expect(merged.context.region).toBe('us-east-1');
      expect(merged.context.cluster).toBe('new-cluster');
    });

    it('converts string to error', () => {
      const error = InfraError.from('string error');
      expect(error.message).toBe('string error');
    });
  });

  describe('InfraError.fromAwsError', () => {
    it('extracts AWS error code and message', () => {
      const stderr = 'An error occurred (ResourceNotFoundException) when calling the DescribeCluster operation: Cluster not found';
      const error = InfraError.fromAwsError('Failed', stderr, { cluster: 'test' });
      expect(error.context.awsErrorCode).toBe('ResourceNotFoundException');
      expect(error.context.awsErrorMessage).toBe('Cluster not found');
      expect(error.context.cluster).toBe('test');
    });

    it('handles stderr without standard format', () => {
      const error = InfraError.fromAwsError('Failed', 'Unknown error');
      expect(error.context.awsErrorCode).toBeUndefined();
      expect(error.context.awsErrorMessage).toBe('Unknown error');
    });
  });

  describe('format', () => {
    it('formats error with context', () => {
      const error = new InfraError('Test error', {
        region: 'ap-northeast-1',
        cluster: 'my-cluster',
      });
      const formatted = error.format();
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('region: ap-northeast-1');
      expect(formatted).toContain('cluster: my-cluster');
    });

    it('formats error without context', () => {
      const error = new InfraError('Simple error');
      expect(error.format()).toBe('Simple error');
    });
  });
});
