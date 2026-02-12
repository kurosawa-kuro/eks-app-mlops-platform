import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KubernetesMonitor } from '../../../../infrastructure/kubernetes/monitor/KubernetesMonitor.js';
import type { KubernetesMonitorDependencies } from '../../../../infrastructure/kubernetes/monitor/KubernetesMonitor.js';

describe('KubernetesMonitor', () => {
  const mockDeps: KubernetesMonitorDependencies = {
    run: vi.fn(),
    log: {
      info: vi.fn(),
      pass: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      skip: vi.fn(),
      dryRun: vi.fn(),
      debug: vi.fn(),
      section: vi.fn(),
      header: vi.fn(),
      phase: vi.fn(),
      status: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateKubeconfig', () => {
    it('should update kubeconfig successfully', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('');

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const result = monitor.updateKubeconfig();

      expect(result).toBe(true);
      expect(mockDeps.run).toHaveBeenCalledWith(
        'aws eks update-kubeconfig --region ap-northeast-1 --name test-cluster'
      );
    });

    it('should return false on failure', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Update failed');
      });

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const result = monitor.updateKubeconfig();

      expect(result).toBe(false);
    });
  });

  describe('getNodes', () => {
    it('should parse node information', () => {
      const nodesJson = JSON.stringify({
        items: [
          {
            metadata: {
              name: 'node-1',
              labels: {
                'node.kubernetes.io/instance-type': 't3.medium',
                'topology.kubernetes.io/zone': 'ap-northeast-1a',
              },
            },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
          {
            metadata: {
              name: 'node-2',
              labels: {
                'node.kubernetes.io/instance-type': 't3.large',
                'topology.kubernetes.io/zone': 'ap-northeast-1b',
              },
            },
            status: {
              conditions: [{ type: 'Ready', status: 'False' }],
            },
          },
        ],
      });

      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(nodesJson);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const nodes = monitor.getNodes();

      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toEqual({
        name: 'node-1',
        ready: true,
        instanceType: 't3.medium',
        zone: 'ap-northeast-1a',
      });
      expect(nodes[1]).toEqual({
        name: 'node-2',
        ready: false,
        instanceType: 't3.large',
        zone: 'ap-northeast-1b',
      });
    });

    it('should return empty array on failure', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const nodes = monitor.getNodes();

      expect(nodes).toEqual([]);
    });

    it('should handle invalid JSON', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const nodes = monitor.getNodes();

      expect(nodes).toEqual([]);
    });
  });

  describe('getReadyNodeCount', () => {
    it('should count ready nodes', () => {
      const nodesJson = JSON.stringify({
        items: [
          {
            metadata: { name: 'node-1' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          },
          {
            metadata: { name: 'node-2' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          },
          {
            metadata: { name: 'node-3' },
            status: { conditions: [{ type: 'Ready', status: 'False' }] },
          },
        ],
      });

      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(nodesJson);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const count = monitor.getReadyNodeCount();

      expect(count).toBe(2);
    });
  });

  describe('canConnect', () => {
    it('should return true when connected', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('Kubernetes control plane is running');

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const result = monitor.canConnect();

      expect(result).toBe(true);
    });

    it('should return false when not connected', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const result = monitor.canConnect();

      expect(result).toBe(false);
    });
  });

  describe('getServerVersion', () => {
    it('should return server version', () => {
      const versionJson = JSON.stringify({
        serverVersion: { gitVersion: 'v1.29.0' },
      });

      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(versionJson);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const version = monitor.getServerVersion();

      expect(version).toBe('v1.29.0');
    });

    it('should return null on failure', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const monitor = new KubernetesMonitor(
        { clusterName: 'test-cluster', region: 'ap-northeast-1' },
        mockDeps
      );
      const version = monitor.getServerVersion();

      expect(version).toBeNull();
    });
  });
});
