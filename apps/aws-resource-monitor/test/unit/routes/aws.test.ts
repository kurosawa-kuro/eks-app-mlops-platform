vi.mock('../../../src/presentation/helpers/render.js', () => ({
  render: vi.fn().mockResolvedValue(new Response('<html></html>')),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createAWSRoutes } from '../../../src/presentation/routes/aws/index.js'
import { createContainer, asValue, InjectionMode } from 'awilix'

const now = new Date('2025-01-15T00:00:00Z')

function createTestRouteContext() {
  const mockResourceService = {
    getResources: vi.fn().mockResolvedValue([]),
    getAllResources: vi.fn().mockResolvedValue([
      {
        id: '1',
        timestamp: now,
        type: 'ec2',
        resourceId: 'i-123',
        name: 'test',
        state: 'running',
        createdAt: now,
        metadata: {},
        tags: {},
      },
    ]),
    getResourcesByCategory: vi.fn().mockResolvedValue([]),
    getEksRelatedResources: vi.fn().mockResolvedValue([]),
    refreshAll: vi.fn().mockResolvedValue(undefined),
    getLastUpdated: vi.fn().mockReturnValue(new Map()),
    getStats: vi.fn().mockResolvedValue({
      total: 1,
      byType: { ec2: 1 },
      byCategory: { compute: 1 },
      lastUpdated: now,
    }),
  }

  const mockCostService = {
    getCosts: vi.fn().mockResolvedValue([]),
    getCostSummary: vi.fn().mockResolvedValue({
      totalAmount: 100,
      unit: 'USD',
      periodStart: '2025-01-01',
      periodEnd: '2025-02-01',
      serviceCount: 1,
      costs: [
        {
          id: 'cost-0',
          periodStart: '2025-01-01',
          periodEnd: '2025-02-01',
          service: 'EC2',
          amount: 100,
          unit: 'USD',
        },
      ],
    }),
    refresh: vi.fn().mockResolvedValue(undefined),
    getLastUpdated: vi.fn().mockReturnValue(now),
  }

  const mockEksSystemlogService = {
    getNodegroupInstances: vi.fn().mockResolvedValue(null),
    getInstanceSystemlog: vi.fn().mockResolvedValue(null),
    getNodegroupInstancesWithKubeletStatus: vi.fn().mockResolvedValue(null),
    parseKubeletStatus: vi.fn().mockReturnValue('unknown'),
  }

  const container = createContainer({ injectionMode: InjectionMode.CLASSIC })
  container.register({
    cacheService: asValue({
      get: vi.fn(),
      set: vi.fn(),
      invalidate: vi.fn(),
      invalidateByPrefix: vi.fn(),
      invalidateAll: vi.fn(),
      getLastUpdated: vi.fn(),
      has: vi.fn(),
      keys: vi.fn(),
    }),
    resourceService: asValue(mockResourceService),
    costService: asValue(mockCostService),
    eksSystemlogService: asValue(mockEksSystemlogService),
    k8sService: asValue(null),
  })

  const appConfig = {
    appEnv: 'local',
    appMode: 'origin',
    projectName: 'test',
    port: 8001,
    logLevel: 'info',
    rateLimitPerMinute: 100,
    awsRegion: 'ap-northeast-1',
    cacheTtlResources: 300000,
    cacheTtlCosts: 3600000,
    alertEnabled: false,
    alertChannel: 'slack',
    alertSlackWebhookUrl: '',
    alertEmailTo: '',
  }

  return { container, appConfig, mockResourceService, mockCostService }
}

describe('AWS API Routes', () => {
  let app: Hono
  let mockResourceService: ReturnType<typeof createTestRouteContext>['mockResourceService']
  let mockCostService: ReturnType<typeof createTestRouteContext>['mockCostService']

  beforeEach(() => {
    vi.clearAllMocks()

    const ctx = createTestRouteContext()
    mockResourceService = ctx.mockResourceService
    mockCostService = ctx.mockCostService

    app = new Hono()
    app.route('/aws', createAWSRoutes({ container: ctx.container, appConfig: ctx.appConfig } as any))
  })

  describe('GET /aws/api/resources', () => {
    it('returns 200 with resources array', async () => {
      const res = await app.request('/aws/api/resources')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.resources).toHaveLength(1)
      expect(json.data.count).toBe(1)
      expect(json.data.resources[0].resourceId).toBe('i-123')
      expect(json.data.resources[0].type).toBe('ec2')
      expect(json.data.resources[0].state).toBe('running')
      expect(json.data.resources[0].timestamp).toBe('2025-01-15T00:00:00.000Z')
      expect(json.data.resources[0].createdAt).toBe('2025-01-15T00:00:00.000Z')
      expect(mockResourceService.getAllResources).toHaveBeenCalledWith(false)
    })
  })

  describe('GET /aws/api/resources/stats', () => {
    it('returns 200 with stats object', async () => {
      const res = await app.request('/aws/api/resources/stats')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.stats.total).toBe(1)
      expect(json.data.stats.byType).toEqual({ ec2: 1 })
      expect(json.data.stats.byCategory).toEqual({ compute: 1 })
      expect(json.data.lastUpdated).toEqual({})
      expect(mockResourceService.getStats).toHaveBeenCalledOnce()
      expect(mockResourceService.getLastUpdated).toHaveBeenCalledOnce()
    })
  })

  describe('POST /aws/api/resources/refresh', () => {
    it('returns 200 with success message', async () => {
      const res = await app.request('/aws/api/resources/refresh', { method: 'POST' })
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toBe('Cache invalidated. Resources will be fetched fresh on next request.')
      expect(mockResourceService.refreshAll).toHaveBeenCalledOnce()
    })
  })

  describe('GET /aws/api/costs', () => {
    it('returns 200 with cost summary', async () => {
      const res = await app.request('/aws/api/costs')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.summary.totalAmount).toBe(100)
      expect(json.data.summary.unit).toBe('USD')
      expect(json.data.summary.periodStart).toBe('2025-01-01')
      expect(json.data.summary.periodEnd).toBe('2025-02-01')
      expect(json.data.summary.serviceCount).toBe(1)
      expect(json.data.summary.costs).toHaveLength(1)
      expect(json.data.summary.costs[0].service).toBe('EC2')
      expect(json.data.summary.costs[0].amount).toBe(100)
      expect(json.data.lastUpdated).toBe('2025-01-15T00:00:00.000Z')
      expect(mockCostService.getCostSummary).toHaveBeenCalledWith(false)
    })
  })
})
