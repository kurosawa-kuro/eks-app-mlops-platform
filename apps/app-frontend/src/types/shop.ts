/**
 * EC Shop Type Definitions
 * Matches backend API response structures
 */

// =============================================================================
// Product Types
// =============================================================================

export interface Product {
  id: string
  name: string
  description: string
  price: number
  imageUrl?: string
  stock: number
  category?: string
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Cart Types
// =============================================================================

export interface CartItem {
  productId: string
  qty: number
}

export interface CartItemWithProduct extends CartItem {
  product: Product | null
  itemTotal: number
}

export interface Cart {
  items: CartItemWithProduct[]
  subtotal: number
  itemCount: number
}

// =============================================================================
// Order Types
// =============================================================================

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderItem {
  productId: string
  productName: string
  price: number
  qty: number
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

// =============================================================================
// API Response Types (using ApiResponse wrapper pattern)
// =============================================================================

import type { ApiResponse } from './api'

export type ProductListResponse = ApiResponse<Product[]>
export type ProductResponse = ApiResponse<Product>
export type CartResponse = ApiResponse<Cart>
export type OrderListResponse = ApiResponse<Order[]>
export type OrderResponse = ApiResponse<Order>
export type CheckoutResponse = ApiResponse<Order>

// For simple action responses (add/remove/clear cart)
export interface CartActionResponse {
  success: boolean
  message: string
}

// =============================================================================
// Audit Types
// =============================================================================

export interface AuditLog {
  id: string
  ts: string
  userId: string
  action: string
  detail?: Record<string, unknown>
}

export interface AuditLogFilter {
  userId?: string
  action?: string
  dateFrom?: string
  dateTo?: string
}

export type AuditLogListResponse = ApiResponse<AuditLog[]>
export type AuditActionsResponse = ApiResponse<string[]>

// =============================================================================
// Request Types
// =============================================================================

export interface AddToCartRequest {
  productId: string
  qty?: number
}

export interface RemoveFromCartRequest {
  productId: string
}
