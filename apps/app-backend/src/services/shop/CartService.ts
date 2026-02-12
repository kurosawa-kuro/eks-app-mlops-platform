import type { ICartService, ICartRepository, IProductRepository } from '../../container/types.js'
import type { Cart, Product } from '../../domain/types/shop.js'

/**
 * Cart service - manages shopping cart operations
 */
export class CartService implements ICartService {
  constructor(
    private cartRepository: ICartRepository,
    private productRepository: IProductRepository,
  ) {}

  async getCart(userId: string): Promise<Cart> {
    return this.cartRepository.getCart(userId)
  }

  async getCartWithProducts(userId: string): Promise<{ cart: Cart; products: Map<string, Product> }> {
    const cart = await this.getCart(userId)
    const products = new Map<string, Product>()

    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId)
      if (product) {
        products.set(item.productId, product)
      }
    }

    return { cart, products }
  }

  async addItem(userId: string, productId: string, qty: number = 1): Promise<void> {
    await this.cartRepository.addItem(userId, productId, qty)
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.cartRepository.removeItem(userId, productId)
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartRepository.clearCart(userId)
  }
}
