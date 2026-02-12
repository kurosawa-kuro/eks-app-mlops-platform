/**
 * EC Shop domain types
 */

/**
 * Product entity representing a sellable item
 */
export interface Product {
  id: string
  name: string
  price: number
  description?: string
  imageUrl?: string
}

/**
 * Cart item representing a product in the shopping cart
 */
export interface CartItem {
  productId: string
  qty: number
}

/**
 * Shopping cart for a user
 */
export interface Cart {
  userId: string
  items: CartItem[]
}

/**
 * Order item with denormalized product info at purchase time
 */
export interface OrderItem {
  productId: string
  productName: string
  price: number
  qty: number
}

/**
 * Completed order
 */
export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  createdAt: string
}

/**
 * Audit log entry for tracking user actions
 */
export interface AuditLog {
  id: string
  ts: string
  userId: string
  action: string
  detail?: Record<string, unknown>
}

/**
 * Filter criteria for audit log queries
 * All fields are optional - omitted fields are not filtered
 */
export interface AuditLogFilter {
  userId?: string
  action?: string
  /** Start date (inclusive) - ISO 8601 format */
  dateFrom?: string
  /** End date (inclusive) - ISO 8601 format */
  dateTo?: string
}
