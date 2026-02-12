import { describe, it, expect, beforeEach } from '@jest/globals'
import { CartService } from '../../../../src/services/shop/CartService.js'
import type { IProductRepository, ICartRepository } from '../../../../src/container/types.js'
import type { Product, Cart } from '../../../../src/domain/types/shop.js'

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

describe('CartService', () => {
  let cartService: CartService
  let cartRepository: FakeCartRepository
  let productRepository: FakeProductRepository

  beforeEach(() => {
    cartRepository = new FakeCartRepository()
    productRepository = new FakeProductRepository()
    cartService = new CartService(cartRepository, productRepository)
  })

  describe('getCart', () => {
    it('should return empty cart for new user', async () => {
      const cart = await cartService.getCart('user-1')

      expect(cart.userId).toBe('user-1')
      expect(cart.items).toEqual([])
    })

    it('should return cart with items', async () => {
      await cartService.addItem('user-1', 'p1', 2)

      const cart = await cartService.getCart('user-1')

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0]).toEqual({ productId: 'p1', qty: 2 })
    })
  })

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      await cartService.addItem('user-1', 'p1')

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toHaveLength(1)
      expect(cart.items[0]).toEqual({ productId: 'p1', qty: 1 })
    })

    it('should add item with specified quantity', async () => {
      await cartService.addItem('user-1', 'p1', 3)

      const cart = await cartService.getCart('user-1')
      expect(cart.items[0].qty).toBe(3)
    })

    it('should increment quantity for existing item', async () => {
      await cartService.addItem('user-1', 'p1', 2)
      await cartService.addItem('user-1', 'p1', 3)

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].qty).toBe(5)
    })

    it('should keep separate items for different products', async () => {
      await cartService.addItem('user-1', 'p1', 1)
      await cartService.addItem('user-1', 'p2', 2)

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toHaveLength(2)
    })
  })

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      await cartService.addItem('user-1', 'p1')
      await cartService.addItem('user-1', 'p2')

      await cartService.removeItem('user-1', 'p1')

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].productId).toBe('p2')
    })

    it('should do nothing if item not in cart', async () => {
      await cartService.addItem('user-1', 'p1')

      await cartService.removeItem('user-1', 'p999')

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toHaveLength(1)
    })
  })

  describe('clearCart', () => {
    it('should remove all items from cart', async () => {
      await cartService.addItem('user-1', 'p1')
      await cartService.addItem('user-1', 'p2')

      await cartService.clearCart('user-1')

      const cart = await cartService.getCart('user-1')
      expect(cart.items).toEqual([])
    })
  })

  describe('getCartWithProducts', () => {
    it('should return cart with product details', async () => {
      await cartService.addItem('user-1', 'p1', 2)
      await cartService.addItem('user-1', 'p2', 1)

      const { cart, products } = await cartService.getCartWithProducts('user-1')

      expect(cart.items).toHaveLength(2)
      expect(products.size).toBe(2)
      expect(products.get('p1')).toEqual({ id: 'p1', name: 'Product 1', price: 1000 })
      expect(products.get('p2')).toEqual({ id: 'p2', name: 'Product 2', price: 2000 })
    })

    it('should return empty map for empty cart', async () => {
      const { cart, products } = await cartService.getCartWithProducts('user-1')

      expect(cart.items).toEqual([])
      expect(products.size).toBe(0)
    })
  })
})
