import { PrismaClient } from '@prisma/client'
import type { IOrderRepository } from '../../container/types.js'
import type { Order } from '../../domain/types/shop.js'

/**
 * PostgreSQL order repository using Prisma
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const created = await this.prisma.order.create({
      data: {
        userId: order.userId,
        total: order.total,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            qty: item.qty,
          })),
        },
      },
      include: { items: true },
    })

    return this.toOrder(created)
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(this.toOrder)
  }

  async findById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })
    return order ? this.toOrder(order) : null
  }

  private toOrder(o: {
    id: string
    userId: string
    total: number
    createdAt: Date
    items: Array<{
      productId: string
      productName: string
      price: number
      qty: number
    }>
  }): Order {
    return {
      id: o.id,
      userId: o.userId,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        qty: item.qty,
      })),
    }
  }
}
