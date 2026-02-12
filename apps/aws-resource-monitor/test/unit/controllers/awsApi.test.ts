import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  createResourcesListController,
  createResourcesStatsController,
  createResourcesRefreshController,
  createCostsListController,
  createEksSystemlogController,
  createEksInstanceSystemlogController,
} from '../../../src/presentation/controllers/aws/api.js'

const now = new Date('2025-01-15T00:00:00Z')

const mockResourceService = {
  getResources: vi.fn().mockResolvedValue([
    { id: '1', timestamp: now, type: 'ec2', resourceId: 'i-123', name: 'test-instance', state: 'running', createdAt: now, metadata: {}, tags: {} },
  ]),
  getAllResources: vi.fn().mockResolvedValue([
    { id: '1', timestamp: now, type: 'ec2', resourceId: 'i-123', name: 'test-instance', state: 'running', createdAt: now, metadata: {}, tags: {} },
  ]),
  getResourcesByCategory: vi.fn().mockResolvedValue([]),
  getEksRelatedResources: vi.fn().mockResolvedValue([]),
  refreshAll: vi.fn().mockResolvedValue(undefined),
  getLastUpdated: vi.fn().mockReturnValue(new Map([['ec2', now]])),
  getStats: vi.fn().mockResolvedValue({ total: 5, byType: { ec2: 3, s3: 2 }, byCategory: { compute: 3, storage: 2 }, lastUpdated: now }),
}

const mockCostService = {
  getCosts: vi.fn().mockResolvedValue([]),
  getCostSummary: vi.fn().mockResolvedValue({
    totalAmount: 175.8, unit: 'USD', periodStart: '2025-01-01', periodEnd: '2025-02-01', serviceCount: 2,
    costs: [
      { id: 'cost-0', periodStart: '2025-01-01', periodEnd: '2025-02-01', service: 'Amazon EC2', amount: 150.5, unit: 'USD' },
      { id: 'cost-1', periodStart: '2025-01-01', periodEnd: '2025-02-01', service: 'Amazon S3', amount: 25.3, unit: 'USD' },
    ],
  }),
  refresh: vi.fn().mockResolvedValue(undefined),
  getLastUpdated: vi.fn().mockReturnValue(now),
}

const mockEksSystemlogService = {
  getNodegroupInstances: vi.fn().mockResolvedValue(null),
  getInstanceSystemlog: vi.fn().mockResolvedValue({ instanceId: 'i-123', output: 'boot log', timestamp: now }),
  getNodegroupInstancesWithKubeletStatus: vi.fn().mockResolvedValue({
    clusterName: 'test-cluster', nodegroupName: 'test-ng',
    instances: [{ instanceId: 'i-123', state: 'running', availabilityZone: 'ap-northeast-1a', launchTime: now, privateIpAddress: '10.0.0.1', instanceType: 't3.medium', kubeletStatus: 'joined' }],
  }),
  parseKubeletStatus: vi.fn().mockReturnValue('joined'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createResourcesListController', () => {
  it('should return resources list with success true', async () => {
    const app = new Hono()
    app.get('/test', createResourcesListController(mockResourceService as any))

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.resources).toHaveLength(1)
    expect(body.data.count).toBe(1)
    expect(body.data.resources[0].timestamp).toBe('2025-01-15T00:00:00.000Z')
    expect(body.data.resources[0].createdAt).toBe('2025-01-15T00:00:00.000Z')
    expect(body.data.resources[0].resourceId).toBe('i-123')
    expect(mockResourceService.getAllResources).toHaveBeenCalledWith(false)
  })

  it('should filter by type query parameter', async () => {
    const app = new Hono()
    app.get('/test', createResourcesListController(mockResourceService as any))

    const res = await app.request('/test?type=ec2')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockResourceService.getResources).toHaveBeenCalledWith('ec2', false)
  })
})

describe('createResourcesStatsController', () => {
  it('should return stats with success true', async () => {
    const app = new Hono()
    app.get('/test', createResourcesStatsController(mockResourceService as any))

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.stats.total).toBe(5)
    expect(body.data.stats.byType).toEqual({ ec2: 3, s3: 2 })
    expect(body.data.lastUpdated.ec2).toBe('2025-01-15T00:00:00.000Z')
    expect(mockResourceService.getStats).toHaveBeenCalled()
    expect(mockResourceService.getLastUpdated).toHaveBeenCalled()
  })
})

describe('createResourcesRefreshController', () => {
  it('should refresh and return success message', async () => {
    const app = new Hono()
    app.post('/test', createResourcesRefreshController(mockResourceService as any))

    const res = await app.request('/test', { method: 'POST' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Cache invalidated. Resources will be fetched fresh on next request.')
    expect(mockResourceService.refreshAll).toHaveBeenCalled()
  })
})

describe('createCostsListController', () => {
  it('should return cost summary with success true', async () => {
    const app = new Hono()
    app.get('/test', createCostsListController(mockCostService as any))

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.summary.totalAmount).toBe(175.8)
    expect(body.data.summary.costs).toHaveLength(2)
    expect(body.data.summary.costs[0].service).toBe('Amazon EC2')
    expect(body.data.summary.costs[1].service).toBe('Amazon S3')
    expect(body.data.lastUpdated).toBe('2025-01-15T00:00:00.000Z')
    expect(mockCostService.getCostSummary).toHaveBeenCalledWith(false)
  })
})

describe('createEksSystemlogController', () => {
  it('should return nodegroup instances with kubelet status', async () => {
    const app = new Hono()
    app.get('/test/:cluster/:nodegroup', createEksSystemlogController(mockEksSystemlogService as any))

    const res = await app.request('/test/test-cluster/test-ng')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.clusterName).toBe('test-cluster')
    expect(body.data.nodegroupName).toBe('test-ng')
    expect(body.data.instances).toHaveLength(1)
    expect(body.data.instances[0].instanceId).toBe('i-123')
    expect(body.data.instances[0].launchTime).toBe('2025-01-15T00:00:00.000Z')
    expect(body.data.instances[0].kubeletStatus).toBe('joined')
    expect(mockEksSystemlogService.getNodegroupInstancesWithKubeletStatus).toHaveBeenCalledWith('test-cluster', 'test-ng')
  })
})

describe('createEksInstanceSystemlogController', () => {
  it('should return instance console output', async () => {
    const app = new Hono()
    app.get('/test/:instanceId', createEksInstanceSystemlogController(mockEksSystemlogService as any))

    const res = await app.request('/test/i-123')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.instanceId).toBe('i-123')
    expect(body.data.consoleOutput).toBe('boot log')
    expect(body.data.timestamp).toBe('2025-01-15T00:00:00.000Z')
    expect(mockEksSystemlogService.getInstanceSystemlog).toHaveBeenCalledWith('i-123')
  })
})
