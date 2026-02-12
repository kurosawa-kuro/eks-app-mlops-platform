import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { PrismaClient } from '@prisma/client'
import { HealthService } from '../../../src/services/HealthService.js'
import {
  mockLogger,
  createMockPrismaClient,
} from '../helpers/index.js'

describe('HealthService', () => {
  let healthService: HealthService
  let mockPrisma: ReturnType<typeof createMockPrismaClient>

  beforeEach(() => {
    mockPrisma = createMockPrismaClient()
    healthService = new HealthService(mockPrisma as unknown as PrismaClient, mockLogger)
    jest.clearAllMocks()
  })

  describe('getStatus', () => {
    it('should return status ok when db is connected', async () => {
      const status = await healthService.getStatus()
      expect(status.status).toBe('ok')
    })

    it('should return status degraded when db fails', async () => {
      mockPrisma = createMockPrismaClient({ queryRawFails: true })
      healthService = new HealthService(mockPrisma as unknown as PrismaClient, mockLogger)
      const status = await healthService.getStatus()
      expect(status.status).toBe('degraded')
    })

    it('should return timestamp', async () => {
      const status = await healthService.getStatus()
      expect(status.timestamp).toBeDefined()
      expect(typeof status.timestamp).toBe('string')
    })

    it('should return valid ISO timestamp', async () => {
      const status = await healthService.getStatus()
      const date = new Date(status.timestamp)
      expect(date.toISOString()).toBe(status.timestamp)
    })

    it('should return uptime', async () => {
      const status = await healthService.getStatus()
      expect(typeof status.uptime).toBe('number')
      expect(status.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('testPostgres', () => {
    it('should call prisma $queryRaw', async () => {
      await healthService.testPostgres()
      expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    })

    it('should return connection result', async () => {
      const result = await healthService.testPostgres()
      expect(result.success).toBe(true)
      expect(result.message).toBe('Connected to PostgreSQL')
    })

    it('should log info on successful connection', async () => {
      await healthService.testPostgres()
      expect(mockLogger.info).toHaveBeenCalledWith('PostgreSQL health check passed')
    })

    it('should return failure when connection fails', async () => {
      mockPrisma = createMockPrismaClient({ queryRawFails: true })
      healthService = new HealthService(mockPrisma as unknown as PrismaClient, mockLogger)
      const result = await healthService.testPostgres()
      expect(result.success).toBe(false)
      expect(result.message).toBe('Connection failed')
    })
  })
})
