import { Hono } from 'hono'
import type { Context } from 'hono'
import { container, resolve } from '../../container/index.js'
import type { AuthPayload } from '../../middleware/guard/index.js'

/**
 * Shop API route environment with typed user context
 */
type ShopApiEnv = {
  Variables: {
    user?: AuthPayload
  }
}

const shopApi = new Hono<ShopApiEnv>()

/**
 * Helper to get authenticated user ID from cookie
 */
function getAuthenticatedUser(c: Context<ShopApiEnv>): AuthPayload | null {
  const cookieService = resolve('cookieService')
  const jwtService = resolve('jwtService')

  const token = cookieService.getAuthToken(c)
  if (!token) return null

  // Note: verifyToken is async but we need sync access here
  // This is a simplified version - in production, use middleware
  return null
}

/**
 * Middleware to require authentication via cookie
 * Uses AuthService.verifyRequest() which delegates to auth-gateway for Cognito tokens
 */
async function requireAuth(c: Context<ShopApiEnv>, next: () => Promise<void>) {
  const authService = resolve('authService')

  const payload = await authService.verifyRequest(c)
  if (!payload) {
    return c.json({ success: false, message: 'Not authenticated' }, 401)
  }

  c.set('user', payload)
  await next()
}

/**
 * Helper to get user ID from context (after auth middleware)
 */
function getUserId(c: Context<ShopApiEnv>): string {
  const user = c.get('user')
  if (!user) {
    throw new Error('User not authenticated')
  }
  return user.sub
}

// =============================================================================
// Product API (Public)
// =============================================================================

/**
 * GET /api/shop/products - Get all products
 */
shopApi.get('/products', async (c) => {
  const productService = container.resolve('productService')
  const products = await productService.findAll()

  return c.json({
    success: true,
    data: products,
  })
})

/**
 * GET /api/shop/products/:id - Get product by ID
 */
shopApi.get('/products/:id', async (c) => {
  const productId = c.req.param('id')
  const productService = container.resolve('productService')
  const product = await productService.findById(productId)

  if (!product) {
    return c.json({ success: false, message: 'Product not found' }, 404)
  }

  return c.json({
    success: true,
    data: product,
  })
})

// =============================================================================
// Cart API (Requires Authentication)
// =============================================================================

/**
 * GET /api/shop/cart - Get current user's cart
 */
shopApi.get('/cart', requireAuth, async (c) => {
  const cartService = container.resolve('cartService')
  const userId = getUserId(c)
  const { cart, products } = await cartService.getCartWithProducts(userId)

  // Calculate totals
  let subtotal = 0
  const cartItems = cart.items.map((item) => {
    const product = products.get(item.productId)
    const itemTotal = product ? product.price * item.qty : 0
    subtotal += itemTotal
    return {
      ...item,
      product: product || null,
      itemTotal,
    }
  })

  return c.json({
    success: true,
    data: {
      items: cartItems,
      subtotal,
      itemCount: cart.items.reduce((sum, item) => sum + item.qty, 0),
    },
  })
})

/**
 * POST /api/shop/cart/add - Add item to cart
 */
shopApi.post('/cart/add', requireAuth, async (c) => {
  let body: { productId?: string; qty?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { productId, qty = 1 } = body

  if (!productId) {
    return c.json({ success: false, message: 'productId is required' }, 400)
  }

  const cartService = container.resolve('cartService')
  const shopAuditService = container.resolve('shopAuditService')
  const userId = getUserId(c)

  // Verify product exists
  const productService = container.resolve('productService')
  const product = await productService.findById(productId)
  if (!product) {
    return c.json({ success: false, message: 'Product not found' }, 404)
  }

  await cartService.addItem(userId, productId, qty)
  await shopAuditService.log(userId, `cart:add:${productId}`)

  return c.json({
    success: true,
    message: 'Item added to cart',
  })
})

/**
 * POST /api/shop/cart/remove - Remove item from cart
 */
shopApi.post('/cart/remove', requireAuth, async (c) => {
  let body: { productId?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { productId } = body

  if (!productId) {
    return c.json({ success: false, message: 'productId is required' }, 400)
  }

  const cartService = container.resolve('cartService')
  const shopAuditService = container.resolve('shopAuditService')
  const userId = getUserId(c)

  await cartService.removeItem(userId, productId)
  await shopAuditService.log(userId, `cart:remove:${productId}`)

  return c.json({
    success: true,
    message: 'Item removed from cart',
  })
})

/**
 * DELETE /api/shop/cart - Clear entire cart
 */
shopApi.delete('/cart', requireAuth, async (c) => {
  const cartService = container.resolve('cartService')
  const shopAuditService = container.resolve('shopAuditService')
  const userId = getUserId(c)

  await cartService.clearCart(userId)
  await shopAuditService.log(userId, 'cart:clear')

  return c.json({
    success: true,
    message: 'Cart cleared',
  })
})

// =============================================================================
// Order API (Requires Authentication)
// =============================================================================

/**
 * POST /api/shop/checkout - Checkout cart and create order
 */
shopApi.post('/checkout', requireAuth, async (c) => {
  const orderService = container.resolve('orderService')
  const userId = getUserId(c)
  const order = await orderService.checkout(userId)

  if (!order) {
    return c.json({ success: false, message: 'Cart is empty or checkout failed' }, 400)
  }

  return c.json({
    success: true,
    data: order,
    message: 'Order placed successfully',
  })
})

/**
 * GET /api/shop/orders - Get current user's orders
 */
shopApi.get('/orders', requireAuth, async (c) => {
  const orderService = container.resolve('orderService')
  const userId = getUserId(c)
  const orders = await orderService.findByUserId(userId)

  return c.json({
    success: true,
    data: orders,
  })
})

/**
 * GET /api/shop/orders/:id - Get order by ID
 */
shopApi.get('/orders/:id', requireAuth, async (c) => {
  const orderId = c.req.param('id')
  const orderService = container.resolve('orderService')
  const userId = getUserId(c)
  const order = await orderService.findById(orderId)

  if (!order) {
    return c.json({ success: false, message: 'Order not found' }, 404)
  }

  // Verify order belongs to user
  if (order.userId !== userId) {
    return c.json({ success: false, message: 'Order not found' }, 404)
  }

  return c.json({
    success: true,
    data: order,
  })
})

export { shopApi }
