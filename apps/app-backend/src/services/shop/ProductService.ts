import type { IProductService, IProductRepository } from '../../container/types.js'
import type { Product } from '../../domain/types/shop.js'

/**
 * Product service - thin wrapper around product repository
 */
export class ProductService implements IProductService {
  constructor(
    private productRepository: IProductRepository,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productRepository.findAll()
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepository.findById(id)
  }
}
