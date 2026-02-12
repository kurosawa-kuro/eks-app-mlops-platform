import { api } from './fetcher'
import type { ApiResponse } from '@/types/api'
import type {
  Product,
  Cart,
  Order,
  CartActionResponse,
  AddToCartRequest,
  RemoveFromCartRequest,
} from '@/types/shop'

/**
 * Shop API Client
 * All shop endpoints require authentication (Cookie httpOnly)
 */
export const shopApi = {
  // ==========================================================================
  // Products (Public)
  // ==========================================================================

  /**
   * Get all products
   */
  getProducts: async (): Promise<ApiResponse<Product[]>> => {
    return api.get<Product[]>('/api/shop/products')
  },

  /**
   * Get product by ID
   */
  getProduct: async (id: string): Promise<ApiResponse<Product>> => {
    return api.get<Product>(`/api/shop/products/${id}`)
  },

  // ==========================================================================
  // Cart (Requires Authentication)
  // ==========================================================================

  /**
   * Get current user's cart
   */
  getCart: async (): Promise<ApiResponse<Cart>> => {
    return api.get<Cart>('/api/shop/cart')
  },

  /**
   * Add item to cart
   */
  addToCart: async (data: AddToCartRequest): Promise<CartActionResponse> => {
    return api.post<CartActionResponse>('/api/shop/cart/add', data) as Promise<CartActionResponse>
  },

  /**
   * Remove item from cart
   */
  removeFromCart: async (data: RemoveFromCartRequest): Promise<CartActionResponse> => {
    return api.post<CartActionResponse>('/api/shop/cart/remove', data) as Promise<CartActionResponse>
  },

  /**
   * Clear entire cart
   */
  clearCart: async (): Promise<CartActionResponse> => {
    return api.delete<CartActionResponse>('/api/shop/cart') as Promise<CartActionResponse>
  },

  // ==========================================================================
  // Orders (Requires Authentication)
  // ==========================================================================

  /**
   * Checkout cart and create order
   */
  checkout: async (): Promise<ApiResponse<Order>> => {
    return api.post<Order>('/api/shop/checkout')
  },

  /**
   * Get current user's orders
   */
  getOrders: async (): Promise<ApiResponse<Order[]>> => {
    return api.get<Order[]>('/api/shop/orders')
  },

  /**
   * Get order by ID
   */
  getOrder: async (id: string): Promise<ApiResponse<Order>> => {
    return api.get<Order>(`/api/shop/orders/${id}`)
  },
}
