import { PrismaClient } from '@prisma/client'
import type { IProductRepository } from '../../container/types.js'
import type { Product } from '../../domain/types/shop.js'

/**
 * PostgreSQL product repository using Prisma
 */
export class PrismaProductRepository implements IProductRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return products.map(this.toProduct)
  }

  async findById(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    })
    return product ? this.toProduct(product) : null
  }

  private toProduct(p: { id: string; name: string; price: number; description: string | null; imageUrl: string | null }): Product {
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
    }
  }
}
