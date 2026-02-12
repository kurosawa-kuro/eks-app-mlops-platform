import { describe, it, expect, beforeEach } from '@jest/globals'
import { ShopAuditService } from '../../../../src/services/shop/ShopAuditService.js'
import type { IAuditRepository } from '../../../../src/container/types.js'
import type { AuditLog, AuditLogFilter } from '../../../../src/domain/types/shop.js'

/**
 * Fake audit repository for testing
 */
class FakeAuditRepository implements IAuditRepository {
  private logs: AuditLog[] = []
  private counter = 0

  async add(log: Omit<AuditLog, 'id' | 'ts'>): Promise<void> {
    this.logs.push({
      ...log,
      id: `log-${++this.counter}`,
      ts: new Date().toISOString(),
    })
  }

  /** Add log with specific timestamp (for testing) */
  addWithTimestamp(log: Omit<AuditLog, 'id'>): void {
    this.logs.push({
      ...log,
      id: `log-${++this.counter}`,
    })
  }

  async findAll(): Promise<AuditLog[]> {
    return this.logs
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.logs.filter((log) => log.userId === userId)
  }

  async findWithFilter(filter: AuditLogFilter): Promise<AuditLog[]> {
    return this.logs.filter((log) => {
      if (filter.userId && !log.userId.toLowerCase().includes(filter.userId.toLowerCase())) {
        return false
      }
      if (filter.action && !log.action.toLowerCase().includes(filter.action.toLowerCase())) {
        return false
      }
      if (filter.dateFrom) {
        const logDate = new Date(log.ts)
        const fromDate = new Date(filter.dateFrom)
        if (logDate < fromDate) return false
      }
      if (filter.dateTo) {
        const logDate = new Date(log.ts)
        const toDate = new Date(filter.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (logDate > toDate) return false
      }
      return true
    })
  }

  async getDistinctActions(): Promise<string[]> {
    const actions = [...new Set(this.logs.map((log) => log.action))]
    return actions.sort()
  }
}

describe('ShopAuditService', () => {
  let auditService: ShopAuditService
  let auditRepository: FakeAuditRepository

  beforeEach(() => {
    auditRepository = new FakeAuditRepository()
    auditService = new ShopAuditService(auditRepository)
  })

  describe('log', () => {
    it('should add audit log entry', async () => {
      await auditService.log('user-1', 'cart:add', { productId: 'p1' })

      const logs = await auditService.findAll()
      expect(logs).toHaveLength(1)
      expect(logs[0].userId).toBe('user-1')
      expect(logs[0].action).toBe('cart:add')
      expect(logs[0].detail).toEqual({ productId: 'p1' })
    })

    it('should add log without detail', async () => {
      await auditService.log('user-1', 'page:view')

      const logs = await auditService.findAll()
      expect(logs).toHaveLength(1)
      expect(logs[0].detail).toBeUndefined()
    })

    it('should generate unique id and timestamp', async () => {
      await auditService.log('user-1', 'action-1')
      await auditService.log('user-1', 'action-2')

      const logs = await auditService.findAll()
      expect(logs[0].id).not.toBe(logs[1].id)
      expect(logs[0].ts).toBeDefined()
      expect(logs[1].ts).toBeDefined()
    })
  })

  describe('findAll', () => {
    it('should return all logs', async () => {
      await auditService.log('user-1', 'action-1')
      await auditService.log('user-2', 'action-2')
      await auditService.log('user-1', 'action-3')

      const logs = await auditService.findAll()
      expect(logs).toHaveLength(3)
    })

    it('should return empty array when no logs', async () => {
      const logs = await auditService.findAll()
      expect(logs).toEqual([])
    })
  })

  describe('findByUserId', () => {
    it('should return logs for specific user', async () => {
      await auditService.log('user-1', 'action-1')
      await auditService.log('user-2', 'action-2')
      await auditService.log('user-1', 'action-3')

      const logs = await auditService.findByUserId('user-1')
      expect(logs).toHaveLength(2)
      expect(logs.every((log) => log.userId === 'user-1')).toBe(true)
    })

    it('should return empty array for user with no logs', async () => {
      await auditService.log('user-1', 'action-1')

      const logs = await auditService.findByUserId('user-999')
      expect(logs).toEqual([])
    })
  })

  describe('findWithFilter', () => {
    beforeEach(async () => {
      // Prepare test data with specific timestamps
      auditRepository.addWithTimestamp({
        userId: 'user-1',
        action: 'cart:add',
        ts: '2024-01-15T10:00:00.000Z',
      })
      auditRepository.addWithTimestamp({
        userId: 'user-2',
        action: 'cart:remove',
        ts: '2024-01-16T10:00:00.000Z',
      })
      auditRepository.addWithTimestamp({
        userId: 'user-1',
        action: 'order:create',
        ts: '2024-01-17T10:00:00.000Z',
      })
      auditRepository.addWithTimestamp({
        userId: 'admin-1',
        action: 'cart:add',
        ts: '2024-01-18T10:00:00.000Z',
      })
    })

    it('should filter by userId (partial match, case-insensitive)', async () => {
      const logs = await auditService.findWithFilter({ userId: 'user' })
      expect(logs).toHaveLength(3)
      expect(logs.every((log) => log.userId.includes('user'))).toBe(true)
    })

    it('should filter by action (partial match, case-insensitive)', async () => {
      const logs = await auditService.findWithFilter({ action: 'cart' })
      expect(logs).toHaveLength(3)
      expect(logs.every((log) => log.action.includes('cart'))).toBe(true)
    })

    it('should filter by dateFrom', async () => {
      const logs = await auditService.findWithFilter({ dateFrom: '2024-01-17' })
      expect(logs).toHaveLength(2)
      expect(logs.every((log) => new Date(log.ts) >= new Date('2024-01-17'))).toBe(true)
    })

    it('should filter by dateTo', async () => {
      const logs = await auditService.findWithFilter({ dateTo: '2024-01-16' })
      expect(logs).toHaveLength(2)
      expect(
        logs.every((log) => new Date(log.ts) <= new Date('2024-01-16T23:59:59.999Z')),
      ).toBe(true)
    })

    it('should filter by date range', async () => {
      const logs = await auditService.findWithFilter({
        dateFrom: '2024-01-16',
        dateTo: '2024-01-17',
      })
      expect(logs).toHaveLength(2)
    })

    it('should combine multiple filters', async () => {
      const logs = await auditService.findWithFilter({
        userId: 'user-1',
        action: 'cart',
      })
      expect(logs).toHaveLength(1)
      expect(logs[0].userId).toBe('user-1')
      expect(logs[0].action).toBe('cart:add')
    })

    it('should return all logs when no filter', async () => {
      const logs = await auditService.findWithFilter({})
      expect(logs).toHaveLength(4)
    })
  })

  describe('getDistinctActions', () => {
    it('should return unique sorted action values', async () => {
      await auditService.log('user-1', 'cart:add')
      await auditService.log('user-1', 'cart:remove')
      await auditService.log('user-2', 'cart:add')
      await auditService.log('user-2', 'order:create')

      const actions = await auditService.getDistinctActions()
      expect(actions).toEqual(['cart:add', 'cart:remove', 'order:create'])
    })

    it('should return empty array when no logs', async () => {
      const actions = await auditService.getDistinctActions()
      expect(actions).toEqual([])
    })
  })
})
