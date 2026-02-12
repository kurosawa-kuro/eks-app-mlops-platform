import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCostService } from '../../../src/infra/aws/costService.js'
import type { ICostAdapter, CostResult } from '../../../src/infra/aws/adapters/types.js'
import type { CacheService } from '../../../src/infra/cache/memoryCache.js'

const mockAdapterData: CostResult[] = [
  { periodStart: '2025-01-01', periodEnd: '2025-02-01', service: 'Amazon EC2', amount: 150.5, unit: 'USD' },
  { periodStart: '2025-01-01', periodEnd: '2025-02-01', service: 'Amazon S3', amount: 25.3, unit: 'USD' },
]

function createMockCache(): CacheService {
  return {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
    invalidateByPrefix: vi.fn(),
    invalidateAll: vi.fn(),
    getLastUpdated: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    keys: vi.fn().mockReturnValue([]),
  }
}

function createMockCostAdapter(): ICostAdapter {
  return {
    getCostAndUsage: vi.fn().mockResolvedValue(mockAdapterData),
  }
}

describe('costService', () => {
  let mockCache: CacheService
  let mockCostAdapter: ICostAdapter
  const cacheTtlMs = 300_000

  beforeEach(() => {
    vi.clearAllMocks()
    mockCache = createMockCache()
    mockCostAdapter = createMockCostAdapter()
  })

  describe('getCosts', () => {
    it('returns mapped costs from adapter', async () => {
      const service = createCostService(mockCostAdapter, mockCache, cacheTtlMs)
      const costs = await service.getCosts()

      expect(mockCostAdapter.getCostAndUsage).toHaveBeenCalledOnce()
      expect(costs).toHaveLength(2)
      expect(costs[0]).toEqual({
        id: 'cost-0',
        periodStart: '2025-01-01',
        periodEnd: '2025-02-01',
        service: 'Amazon EC2',
        amount: 150.5,
        unit: 'USD',
      })
      expect(mockCache.set).toHaveBeenCalledWith('costs:current', costs, cacheTtlMs)
    })

    it('returns cached data without calling adapter on cache hit', async () => {
      const cachedCosts = [
        { id: 'cost-0', periodStart: '2025-01-01', periodEnd: '2025-02-01', service: 'Amazon EC2', amount: 150.5, unit: 'USD' },
      ]
      vi.mocked(mockCache.get).mockReturnValue(cachedCosts)
      const service = createCostService(mockCostAdapter, mockCache, cacheTtlMs)

      const costs = await service.getCosts()

      expect(costs).toBe(cachedCosts)
      expect(mockCostAdapter.getCostAndUsage).not.toHaveBeenCalled()
    })
  })

  describe('getCostSummary', () => {
    it('returns summary with correct totals', async () => {
      const service = createCostService(mockCostAdapter, mockCache, cacheTtlMs)
      const summary = await service.getCostSummary()

      expect(summary.totalAmount).toBeCloseTo(175.8)
      expect(summary.unit).toBe('USD')
      expect(summary.periodStart).toBe('2025-01-01')
      expect(summary.periodEnd).toBe('2025-02-01')
      expect(summary.serviceCount).toBe(2)
      expect(summary.costs).toHaveLength(2)
    })
  })

  describe('refresh', () => {
    it('invalidates the cache', async () => {
      const service = createCostService(mockCostAdapter, mockCache, cacheTtlMs)
      await service.refresh()
      expect(mockCache.invalidate).toHaveBeenCalledWith('costs:current')
    })
  })

  describe('getLastUpdated', () => {
    it('returns value from cache', () => {
      const lastUpdated = new Date('2025-01-15T10:00:00Z')
      vi.mocked(mockCache.getLastUpdated).mockReturnValue(lastUpdated)
      const service = createCostService(mockCostAdapter, mockCache, cacheTtlMs)

      expect(service.getLastUpdated()).toBe(lastUpdated)
      expect(mockCache.getLastUpdated).toHaveBeenCalledWith('costs:current')
    })
  })
})
