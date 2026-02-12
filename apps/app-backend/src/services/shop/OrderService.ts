import type {
  IOrderService,
  IOrderRepository,
  ICartRepository,
  IProductRepository,
  IShopAuditService,
} from '../../container/types.js'
import type { Order, OrderItem } from '../../domain/types/shop.js'

/**
 * Order service - handles checkout and order management
 */
export class OrderService implements IOrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private cartRepository: ICartRepository,
    private productRepository: IProductRepository,
    private shopAuditService: IShopAuditService,
  ) {}

  async checkout(userId: string): Promise<Order | null> {
    const cart = await this.cartRepository.getCart(userId)

    if (cart.items.length === 0) {
      return null
    }

    // Build order items with denormalized product info
    const orderItems: OrderItem[] = []
    let total = 0

    for (const cartItem of cart.items) {
      const product = await this.productRepository.findById(cartItem.productId)
      if (!product) {
        continue // Skip invalid products
      }

      const itemTotal = product.price * cartItem.qty
      orderItems.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        qty: cartItem.qty,
      })
      total += itemTotal
    }

    if (orderItems.length === 0) {
      return null
    }

    // Create order
    const order = await this.orderRepository.create({
      userId,
      items: orderItems,
      total,
    })

    // Clear cart after successful checkout
    await this.cartRepository.clearCart(userId)

    // Audit log
    await this.shopAuditService.log(userId, `order:checkout:${order.id}`, {
      orderId: order.id,
      total,
      itemCount: orderItems.length,
    })

    return order
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.orderRepository.findByUserId(userId)
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderRepository.findById(id)
  }
}
