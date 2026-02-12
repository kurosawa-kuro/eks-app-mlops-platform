import type { IShopAuditService, IAuditRepository } from '../../container/types.js'
import type { AuditLog, AuditLogFilter } from '../../domain/types/shop.js'

/**
 * Shop audit service - logs user actions for EC shop
 */
export class ShopAuditService implements IShopAuditService {
  constructor(
    private auditRepository: IAuditRepository,
  ) {}

  async log(userId: string, action: string, detail?: Record<string, unknown>): Promise<void> {
    await this.auditRepository.add({
      userId,
      action,
      detail,
    })
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditRepository.findAll()
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.auditRepository.findByUserId(userId)
  }

  async findWithFilter(filter: AuditLogFilter): Promise<AuditLog[]> {
    return this.auditRepository.findWithFilter(filter)
  }

  async getDistinctActions(): Promise<string[]> {
    return this.auditRepository.getDistinctActions()
  }
}
