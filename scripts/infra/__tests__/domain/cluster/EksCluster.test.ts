import { describe, it, expect } from 'vitest';
import { EksCluster } from '../../../domain/cluster/EksCluster.js';
import type { EksClusterState } from '../../../domain/cluster/EksCluster.js';

describe('EksCluster', () => {
  const createCluster = (overrides: Partial<EksClusterState> = {}) => {
    return new EksCluster({
      name: 'test-cluster',
      status: 'ACTIVE',
      version: '1.29',
      endpoint: 'https://cluster.endpoint.eks.amazonaws.com',
      arn: 'arn:aws:eks:ap-northeast-1:123456789:cluster/test-cluster',
      vpcId: 'vpc-12345',
      ...overrides,
    });
  };

  describe('properties', () => {
    it('should expose basic properties', () => {
      const cluster = createCluster();
      expect(cluster.name).toBe('test-cluster');
      expect(cluster.status).toBe('ACTIVE');
      expect(cluster.version).toBe('1.29');
      expect(cluster.arn).toBe('arn:aws:eks:ap-northeast-1:123456789:cluster/test-cluster');
      expect(cluster.vpcId).toBe('vpc-12345');
    });
  });

  describe('status checks', () => {
    it('should identify ready cluster', () => {
      const cluster = createCluster({ status: 'ACTIVE' });
      expect(cluster.isReady()).toBe(true);
      expect(cluster.isCreating()).toBe(false);
      expect(cluster.isUpdating()).toBe(false);
      expect(cluster.isDeleting()).toBe(false);
      expect(cluster.isFailed()).toBe(false);
    });

    it('should identify creating cluster', () => {
      const cluster = createCluster({ status: 'CREATING' });
      expect(cluster.isReady()).toBe(false);
      expect(cluster.isCreating()).toBe(true);
      expect(cluster.isTransitioning()).toBe(true);
    });

    it('should identify updating cluster', () => {
      const cluster = createCluster({ status: 'UPDATING' });
      expect(cluster.isReady()).toBe(false);
      expect(cluster.isUpdating()).toBe(true);
      expect(cluster.isTransitioning()).toBe(true);
    });

    it('should identify deleting cluster', () => {
      const cluster = createCluster({ status: 'DELETING' });
      expect(cluster.isReady()).toBe(false);
      expect(cluster.isDeleting()).toBe(true);
      expect(cluster.isTransitioning()).toBe(true);
    });

    it('should identify failed cluster', () => {
      const cluster = createCluster({ status: 'FAILED' });
      expect(cluster.isReady()).toBe(false);
      expect(cluster.isFailed()).toBe(true);
      expect(cluster.isTransitioning()).toBe(false);
    });
  });

  describe('endpoint', () => {
    it('should return endpoint when present', () => {
      const cluster = createCluster({ endpoint: 'https://my-endpoint.com' });
      expect(cluster.getEndpoint()).toBe('https://my-endpoint.com');
      expect(cluster.hasEndpoint()).toBe(true);
    });

    it('should handle missing endpoint', () => {
      const cluster = createCluster({ endpoint: undefined });
      expect(cluster.getEndpoint()).toBeUndefined();
      expect(cluster.hasEndpoint()).toBe(false);
    });

    it('should handle empty endpoint', () => {
      const cluster = createCluster({ endpoint: '' });
      expect(cluster.hasEndpoint()).toBe(false);
    });
  });

  describe('toState', () => {
    it('should return a copy of the state', () => {
      const cluster = createCluster();
      const state = cluster.toState();
      expect(state.name).toBe('test-cluster');
      expect(state.status).toBe('ACTIVE');
    });
  });
});
