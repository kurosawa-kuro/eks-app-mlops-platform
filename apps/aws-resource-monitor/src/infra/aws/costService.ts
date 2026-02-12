/**
 * AWS Cost Service
 * Fetches and caches AWS cost data
 */

import type { ICostAdapter } from "./adapters/types.js"
import type { CacheService } from "../cache/memoryCache.js"

export interface Cost {
  id: string
  periodStart: string
  periodEnd: string
  service: string
  amount: number
  unit: string
}

export interface CostSummary {
  totalAmount: number
  unit: string
  periodStart: string
  periodEnd: string
  serviceCount: number
  costs: Cost[]
}

export interface CostService {
  getCosts(forceRefresh?: boolean): Promise<Cost[]>
  getCostSummary(forceRefresh?: boolean): Promise<CostSummary>
  refresh(): Promise<void>
  getLastUpdated(): Date | null
}

const CACHE_KEY = "costs:current"

function getDateRange(): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

export function createCostService(
  costAdapter: ICostAdapter,
  cache: CacheService,
  cacheTtlMs: number
): CostService {
  async function fetchCosts(): Promise<Cost[]> {
    const { start, end } = getDateRange()
    const results = await costAdapter.getCostAndUsage(start, end)

    return results.map((result, index) => ({
      id: `cost-${index}`,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      service: result.service,
      amount: result.amount,
      unit: result.unit,
    }))
  }

  return {
    async getCosts(forceRefresh = false): Promise<Cost[]> {
      if (!forceRefresh) {
        const cached = cache.get<Cost[]>(CACHE_KEY)
        if (cached) return cached
      }

      const costs = await fetchCosts()
      cache.set(CACHE_KEY, costs, cacheTtlMs)
      return costs
    },

    async getCostSummary(forceRefresh = false): Promise<CostSummary> {
      const costs = await this.getCosts(forceRefresh)

      if (costs.length === 0) {
        const { start, end } = getDateRange()
        return {
          totalAmount: 0,
          unit: "USD",
          periodStart: start,
          periodEnd: end,
          serviceCount: 0,
          costs: [],
        }
      }

      const totalAmount = costs.reduce((sum, cost) => sum + cost.amount, 0)
      const unit = costs[0].unit
      const periodStart = costs[0].periodStart
      const periodEnd = costs[0].periodEnd

      return {
        totalAmount,
        unit,
        periodStart,
        periodEnd,
        serviceCount: costs.length,
        costs,
      }
    },

    async refresh(): Promise<void> {
      cache.invalidate(CACHE_KEY)
    },

    getLastUpdated(): Date | null {
      return cache.getLastUpdated(CACHE_KEY)
    },
  }
}
