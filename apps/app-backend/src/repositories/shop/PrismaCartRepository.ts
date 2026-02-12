import { PrismaClient } from '@prisma/client'
import type { ICartRepository } from '../../container/types.js'
import type { Cart } from '../../domain/types/shop.js'

/**
 * PostgreSQL cart repository using Prisma
 */
export class PrismaCartRepository implements ICartRepository {
  constructor(private prisma: PrismaClient) {}

  async getCart(userId: string): Promise<Cart> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return {
      userId,
      items: items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      })),
    }
  }

  async addItem(userId: string, productId: string, qty: number = 1): Promise<void> {
    await this.prisma.cartItem.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      update: {
        qty: { increment: qty },
      },
      create: {
        userId,
        productId,
        qty,
      },
    })
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { userId, productId },
    })
  }

  async clearCart(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    })
  }
}
