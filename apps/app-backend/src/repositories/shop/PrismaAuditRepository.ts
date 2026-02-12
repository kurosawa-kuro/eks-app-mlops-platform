import { PrismaClient, Prisma } from '@prisma/client'
import type { IAuditRepository } from '../../container/types.js'
import type { AuditLog, AuditLogFilter } from '../../domain/types/shop.js'

/**
 * PostgreSQL audit log repository using Prisma
 */
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private prisma: PrismaClient) {}

  async add(log: Omit<AuditLog, 'id' | 'ts'>): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: log.userId,
        action: log.action,
        detail: log.detail as Prisma.InputJsonValue | undefined,
      },
    })
  }

  async findAll(): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { ts: 'desc' },
    })
    return logs.map(this.toAuditLog)
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { ts: 'desc' },
    })
    return logs.map(this.toAuditLog)
  }

  async findWithFilter(filter: AuditLogFilter): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {}

    if (filter.userId) {
      where.userId = { contains: filter.userId, mode: 'insensitive' }
    }

    if (filter.action) {
      where.action = { contains: filter.action, mode: 'insensitive' }
    }

    if (filter.dateFrom || filter.dateTo) {
      where.ts = {}
      if (filter.dateFrom) {
        where.ts.gte = new Date(filter.dateFrom)
      }
      if (filter.dateTo) {
        // End of day for inclusive date range
        const endDate = new Date(filter.dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.ts.lte = endDate
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { ts: 'desc' },
    })
    return logs.map(this.toAuditLog)
  }

  async getDistinctActions(): Promise<string[]> {
    const results = await this.prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    })
    return results.map((r) => r.action)
  }

  private toAuditLog(l: {
    id: string
    ts: Date
    userId: string
    action: string
    detail: Prisma.JsonValue | null
  }): AuditLog {
    return {
      id: l.id,
      ts: l.ts.toISOString(),
      userId: l.userId,
      action: l.action,
      detail: l.detail as Record<string, unknown> | undefined,
    }
  }
}
