import type { Logger } from 'pino'
import type { PrismaClient } from '@prisma/client'
import type { IHealthService } from '../container/types.js'
import type { HealthStatus, ConnectionResult } from '../domain/types/health.js'

/**
 * Health check service for application and database status
 * Uses Prisma client directly for DB connectivity checks (works with any PostgreSQL including CNPG)
 */
export class HealthService implements IHealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async getStatus(): Promise<HealthStatus> {
    // Check DB connection using Prisma
    let dbConnected = false
    try {
      const result = await this.testPostgres()
      dbConnected = result.success
    } catch {
      dbConnected = false
    }

    return {
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: {
        connected: dbConnected,
        status: dbConnected ? 'ok' : 'error',
      },
    }
  }

  async testPostgres(): Promise<ConnectionResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1 as connected`
      this.logger.info('PostgreSQL health check passed')
      return { success: true, message: 'Connected to PostgreSQL' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn({ message }, 'PostgreSQL health check failed')
      return { success: false, message }
    }
  }
}
