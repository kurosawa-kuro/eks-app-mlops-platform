import { describe, it, expect, beforeEach } from '@jest/globals'
import { OrderService } from '../../../../src/services/shop/OrderService.js'
import { ShopAuditService } from '../../../../src/services/shop/ShopAuditService.js'
import type { IProductRepository, IOrderRepository, ICartRepository, IAuditRepository } from '../../../../src/container/types.js'
import type { Product, Cart, Order, AuditLog } from '../../../../src/domain/types/shop.js'

/**
 * Fake product repository for testing
 */
class FakeProductRepository implements IProductRepository {
  private products: Product[] = [
    { id: 'p1', name: 'Product 1', price: 1000 },
    { id: 'p2', name: 'Product 2', price: 2000 },
    { id: 'p3', name: 'Product 3', price: 3000 },
  ]

  async findAll(): Promise<Product[]> {
    return this.products
  }

  async findById(id: string): Promise<Product | null> {
    return this.products.find((p) => p.id === id) ?? null
  }
}

/**
 * Fake cart repository for testing
 */
class FakeCartRepository implements ICartRepository {
  private carts: Map<string, Cart> = new Map()

  async getCart(userId: string): Promise<Cart> {
    let cart = this.carts.get(userId)
    if (!cart) {
      cart = { userId, items: [] }
      this.carts.set(userId, cart)
    }
    return cart
  }

  async addItem(userId: string, productId: string, qty: number = 1): Promise<void> {
    const cart = await this.getCart(userId)
    const existingItem = cart.items.find((item) => item.productId === productId)
    if (existingItem) {
      existingItem.qty += qty
    } else {
      cart.items.push({ productId, qty })
    }
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    const cart = await this.getCart(userId)
    cart.items = cart.items.filter((item) => item.productId !== productId)
  }

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getCart(userId)
    cart.items = []
  }
}

/**
 * Fake order repository for testing
 */
class FakeOrderRepository implements IOrderRepository {
  private orders: Order[] = []
  private counter = 0

  async create(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const newOrder: Order = {
      ...order,
      id: `order-${++this.counter}`,
      createdAt: new Date().toISOString(),
    }
    this.orders.push(newOrder)
    return newOrder
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.orders.filter((o) => o.userId === userId)
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.find((o) => o.id === id) ?? null
  }
}

/**
 * Fake audit repository for testing
 */
class FakeAuditRepository implements IAuditRepository {
  private logs: AuditLog[] = []
  private counter = 0

  async add(log: Omit<AuditLog, 'id' | 'ts'>): Promise<void> {
    this.logs.push({
      ...log,
      id: `log-${++this.counter}`,
      ts: new Date().toISOString(),
    })
  }

  async findAll(): Promise<AuditLog[]> {
    return this.logs
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.logs.filter((log) => log.userId === userId)
  }
}

describe('OrderService', () => {
  let orderService: OrderService
  let orderRepository: FakeOrderRepository
  let cartRepository: FakeCartRepository
  let productRepository: FakeProductRepository
  let auditService: ShopAuditService
  let auditRepository: FakeAuditRepository

  beforeEach(() => {
    orderRepository = new FakeOrderRepository()
    cartRepository = new FakeCartRepository()
    productRepository = new FakeProductRepository()
    auditRepository = new FakeAuditRepository()
    auditService = new ShopAuditService(auditRepository)
    orderService = new OrderService(
      orderRepository,
      cartRepository,
      productRepository,
      auditService,
    )
  })

  describe('checkout', () => {
    it('should create order from cart items', async () => {
      await cartRepository.addItem('user-1', 'p1', 2)
      await cartRepository.addItem('user-1', 'p2', 1)

      const order = await orderService.checkout('user-1')

      expect(order).not.toBeNull()
      expect(order!.userId).toBe('user-1')
      expect(order!.items).toHaveLength(2)
      expect(order!.total).toBe(4000) // (1000 * 2) + (2000 * 1)
    })

    it('should denormalize product info in order items', async () => {
      await cartRepository.addItem('user-1', 'p1', 1)

      const order = await orderService.checkout('user-1')

      expect(order!.items[0]).toEqual({
        productId: 'p1',
        productName: 'Product 1',
        price: 1000,
        qty: 1,
      })
    })

    it('should clear cart after checkout', async () => {
      await cartRepository.addItem('user-1', 'p1', 1)

      await orderService.checkout('user-1')

      const cart = await cartRepository.getCart('user-1')
      expect(cart.items).toEqual([])
    })

    it('should create audit log for checkout', async () => {
      await cartRepository.addItem('user-1', 'p1', 2)

      const order = await orderService.checkout('user-1')

      const logs = await auditService.findByUserId('user-1')
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe(`order:checkout:${order!.id}`)
      expect(logs[0].detail).toEqual({
        orderId: order!.id,
        total: 2000,
        itemCount: 1,
      })
    })

    it('should generate unique order id and timestamp', async () => {
      await cartRepository.addItem('user-1', 'p1', 1)
      const order1 = await orderService.checkout('user-1')

      await cartRepository.addItem('user-1', 'p2', 1)
      const order2 = await orderService.checkout('user-1')

      expect(order1!.id).not.toBe(order2!.id)
      expect(order1!.createdAt).toBeDefined()
      expect(order2!.createdAt).toBeDefined()
    })

    it('should return null for empty cart', async () => {
      const order = await orderService.checkout('user-1')

      expect(order).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should return orders for specific user', async () => {
      await cartRepository.addItem('user-1', 'p1', 1)
      await orderService.checkout('user-1')
      await cartRepository.addItem('user-1', 'p2', 1)
      await orderService.checkout('user-1')
      await cartRepository.addItem('user-2', 'p1', 1)
      await orderService.checkout('user-2')

      const orders = await orderService.findByUserId('user-1')

      expect(orders).toHaveLength(2)
      expect(orders.every((o) => o.userId === 'user-1')).toBe(true)
    })

    it('should return empty array for user with no orders', async () => {
      const orders = await orderService.findByUserId('user-999')

      expect(orders).toEqual([])
    })
  })

  describe('findById', () => {
    it('should return order by id', async () => {
      await cartRepository.addItem('user-1', 'p1', 1)
      const createdOrder = await orderService.checkout('user-1')

      const order = await orderService.findById(createdOrder!.id)

      expect(order).not.toBeNull()
      expect(order!.id).toBe(createdOrder!.id)
      expect(order!.total).toBe(1000)
    })

    it('should return null for non-existent order', async () => {
      const order = await orderService.findById('order-999')

      expect(order).toBeNull()
    })
  })
})
