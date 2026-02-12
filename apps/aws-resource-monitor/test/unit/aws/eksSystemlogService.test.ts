import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEKSSystemlogService } from '../../../src/infra/aws/eksSystemlogService.js'

const mockEksAdapter = {
  listClusters: vi.fn(),
  describeCluster: vi.fn(),
  listNodegroups: vi.fn(),
  describeNodegroup: vi.fn(),
  listAddons: vi.fn(),
  describeAddon: vi.fn(),
}

const mockEc2Adapter = {
  describeInstances: vi.fn(),
  describeInstancesByIds: vi.fn(),
  describeNatGateways: vi.fn(),
  describeElasticIps: vi.fn(),
  describeVolumes: vi.fn(),
  describeSecurityGroups: vi.fn(),
  describeKeyPairs: vi.fn(),
  getConsoleOutput: vi.fn(),
}

describe('EKSSystemlogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const service = createEKSSystemlogService(
    mockEksAdapter as any,
    mockEc2Adapter as any
  )

  describe('parseKubeletStatus', () => {
    it('returns "joined" for "Successfully registered node"', () => {
      const result = service.parseKubeletStatus('Successfully registered node ip-10-0-1-42')
      expect(result).toBe('joined')
    })

    it('returns "failed" for "kubelet failed to start"', () => {
      const result = service.parseKubeletStatus('kubelet failed to start due to misconfiguration')
      expect(result).toBe('failed')
    })

    it('returns "joining" for "starting kubelet"', () => {
      const result = service.parseKubeletStatus('starting kubelet process...')
      expect(result).toBe('joining')
    })

    it('returns "unknown" for null input', () => {
      const result = service.parseKubeletStatus(null)
      expect(result).toBe('unknown')
    })

    it('returns "unknown" for unrecognized text', () => {
      const result = service.parseKubeletStatus('some random console output with no keywords')
      expect(result).toBe('unknown')
    })
  })

  describe('getNodegroupInstances', () => {
    it('returns NodegroupSystemlogInfo with correct shape', async () => {
      mockEksAdapter.describeNodegroup.mockResolvedValue({
        scalingConfig: { desiredSize: 2, minSize: 1, maxSize: 3 },
        status: 'ACTIVE',
        instanceTypes: ['t3.medium'],
        capacityType: 'ON_DEMAND',
        amiType: 'AL2_x86_64',
      })

      mockEc2Adapter.describeInstances.mockResolvedValue([
        {
          InstanceId: 'i-123',
          State: { Name: 'running' },
          Placement: { AvailabilityZone: 'ap-northeast-1a' },
          LaunchTime: new Date('2025-01-01'),
          PrivateIpAddress: '10.0.0.1',
          InstanceType: 't3.medium',
          Tags: [
            { Key: 'eks:nodegroup-name', Value: 'test-ng' },
            { Key: 'eks:cluster-name', Value: 'test-cluster' },
          ],
        },
      ])

      const result = await service.getNodegroupInstances('test-cluster', 'test-ng')

      expect(result).not.toBeNull()
      expect(result!.clusterName).toBe('test-cluster')
      expect(result!.nodegroupName).toBe('test-ng')
      expect(result!.nodegroup).toEqual({
        status: 'ACTIVE',
        instanceTypes: ['t3.medium'],
        desiredSize: 2,
        minSize: 1,
        maxSize: 3,
        capacityType: 'ON_DEMAND',
        amiType: 'AL2_x86_64',
      })
      expect(result!.instances).toHaveLength(1)
      expect(result!.instances[0]).toEqual({
        instanceId: 'i-123',
        state: 'running',
        availabilityZone: 'ap-northeast-1a',
        launchTime: new Date('2025-01-01'),
        privateIpAddress: '10.0.0.1',
        instanceType: 't3.medium',
      })

      expect(mockEksAdapter.describeNodegroup).toHaveBeenCalledWith('test-cluster', 'test-ng')
      expect(mockEc2Adapter.describeInstances).toHaveBeenCalledOnce()
    })
  })

  describe('getInstanceSystemlog', () => {
    it('delegates to ec2Adapter.getConsoleOutput and returns result', async () => {
      const timestamp = new Date('2025-06-01T12:00:00Z')
      mockEc2Adapter.getConsoleOutput.mockResolvedValue({
        instanceId: 'i-123',
        output: 'test output',
        timestamp,
      })

      const result = await service.getInstanceSystemlog('i-123')

      expect(result).toEqual({
        instanceId: 'i-123',
        output: 'test output',
        timestamp,
      })
      expect(mockEc2Adapter.getConsoleOutput).toHaveBeenCalledWith('i-123')
    })
  })

  describe('getNodegroupInstancesWithKubeletStatus', () => {
    it('returns instances with kubeletStatus derived from console output', async () => {
      mockEc2Adapter.describeInstances.mockResolvedValue([
        {
          InstanceId: 'i-abc',
          State: { Name: 'running' },
          Placement: { AvailabilityZone: 'ap-northeast-1a' },
          LaunchTime: new Date('2025-01-01'),
          PrivateIpAddress: '10.0.0.10',
          InstanceType: 't3.medium',
          Tags: [
            { Key: 'eks:nodegroup-name', Value: 'ng-1' },
            { Key: 'eks:cluster-name', Value: 'my-cluster' },
          ],
        },
        {
          InstanceId: 'i-def',
          State: { Name: 'running' },
          Placement: { AvailabilityZone: 'ap-northeast-1c' },
          LaunchTime: new Date('2025-01-02'),
          PrivateIpAddress: '10.0.0.11',
          InstanceType: 't3.medium',
          Tags: [
            { Key: 'eks:nodegroup-name', Value: 'ng-1' },
            { Key: 'eks:cluster-name', Value: 'my-cluster' },
          ],
        },
      ])

      mockEc2Adapter.getConsoleOutput
        .mockResolvedValueOnce({
          instanceId: 'i-abc',
          output: 'Successfully registered node ip-10-0-0-10',
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          instanceId: 'i-def',
          output: 'starting kubelet process...',
          timestamp: new Date(),
        })

      const result = await service.getNodegroupInstancesWithKubeletStatus('my-cluster', 'ng-1')

      expect(result).not.toBeNull()
      expect(result!.clusterName).toBe('my-cluster')
      expect(result!.nodegroupName).toBe('ng-1')
      expect(result!.instances).toHaveLength(2)

      expect(result!.instances[0].instanceId).toBe('i-abc')
      expect(result!.instances[0].kubeletStatus).toBe('joined')

      expect(result!.instances[1].instanceId).toBe('i-def')
      expect(result!.instances[1].kubeletStatus).toBe('joining')
    })
  })
})
