import { Hono } from 'hono'
import type { Context } from 'hono'
import { container } from '../../container/index.js'
import {
  optionalAuth,
  authRequired,
  type AuthPayload,
} from '../../middleware/guard/index.js'
import { renderPage } from '../../config/ejs.js'

/**
 * Shop route environment with typed user context
 */
type ShopEnv = {
  Variables: {
    user?: AuthPayload
  }
}

const shopRoutes = new Hono<ShopEnv>()

/**
 * Helper to get authenticated user ID
 * @throws Error if user is not authenticated (should not happen if authRequired is used)
 */
function getUserId(c: Context<ShopEnv>): string {
  const user = c.get('user')
  if (!user) {
    throw new Error('User not authenticated')
  }
  return user.sub
}

// =============================================================================
// Product Routes (Guest accessible)
// =============================================================================

/**
 * GET /shop/products - Product list page (SSR)
 * Guest access allowed - login not required
 */
shopRoutes.get('/products', optionalAuth(), async (c) => {
  const productService = container.resolve('productService')
  const products = await productService.findAll()
  const user = c.get('user')

  const html = renderPage('shop/products', {
    title: '商品一覧 - EC Shop',
    products,
    user,
    currentPath: '/shop/products',
    navType: 'shop',
  })
  return c.html(html)
})

// =============================================================================
// Cart Routes (Login required)
// =============================================================================

/**
 * GET /shop/cart - Cart page (SSR)
 * Login required - redirects to /login if not authenticated
 */
shopRoutes.get('/cart', authRequired({ redirectTo: '/login' }), async (c) => {
  const cartService = container.resolve('cartService')
  const { cart, products } = await cartService.getCartWithProducts(getUserId(c))
  const user = c.get('user')

  // Calculate totals
  let subtotal = 0
  const cartItems = cart.items.map((item) => {
    const product = products.get(item.productId)
    const itemTotal = product ? product.price * item.qty : 0
    subtotal += itemTotal
    return {
      ...item,
      product,
      itemTotal,
    }
  })

  const html = renderPage('shop/cart', {
    title: 'カート - EC Shop',
    cartItems,
    subtotal,
    user,
    currentPath: '/shop/cart',
    navType: 'shop',
  })
  return c.html(html)
})

/**
 * POST /shop/cart/add - Add item to cart
 * Login required
 */
shopRoutes.post('/cart/add', authRequired({ redirectTo: '/login' }), async (c) => {
  const body = await c.req.parseBody()
  const productId = body['productId'] as string

  if (!productId) {
    return c.redirect('/shop/products')
  }

  const cartService = container.resolve('cartService')
  const shopAuditService = container.resolve('shopAuditService')
  const userId = getUserId(c)

  await cartService.addItem(userId, productId)
  await shopAuditService.log(userId, `cart:add:${productId}`)

  return c.redirect('/shop/cart')
})

/**
 * POST /shop/cart/remove - Remove item from cart
 * Login required
 */
shopRoutes.post('/cart/remove', authRequired({ redirectTo: '/login' }), async (c) => {
  const body = await c.req.parseBody()
  const productId = body['productId'] as string

  if (!productId) {
    return c.redirect('/shop/cart')
  }

  const cartService = container.resolve('cartService')
  const shopAuditService = container.resolve('shopAuditService')
  const userId = getUserId(c)

  await cartService.removeItem(userId, productId)
  await shopAuditService.log(userId, `cart:remove:${productId}`)

  return c.redirect('/shop/cart')
})

// =============================================================================
// Order Routes (Login required)
// =============================================================================

/**
 * POST /shop/checkout - Checkout cart and create order
 * Login required
 */
shopRoutes.post('/checkout', authRequired({ redirectTo: '/login' }), async (c) => {
  const orderService = container.resolve('orderService')
  const order = await orderService.checkout(getUserId(c))

  if (!order) {
    // Empty cart or no valid items
    return c.redirect('/shop/cart')
  }

  return c.redirect(`/shop/orders/${order.id}`)
})

/**
 * GET /shop/orders - Order list page (SSR)
 * Login required
 */
shopRoutes.get('/orders', authRequired({ redirectTo: '/login' }), async (c) => {
  const orderService = container.resolve('orderService')
  const orders = await orderService.findByUserId(getUserId(c))
  const user = c.get('user')

  const html = renderPage('shop/orders', {
    title: '注文履歴 - EC Shop',
    orders,
    user,
    currentPath: '/shop/orders',
    navType: 'shop',
  })
  return c.html(html)
})

/**
 * GET /shop/orders/:id - Order detail page (SSR)
 * Login required
 */
shopRoutes.get('/orders/:id', authRequired({ redirectTo: '/login' }), async (c) => {
  const orderId = c.req.param('id')
  const orderService = container.resolve('orderService')
  const order = await orderService.findById(orderId)
  const user = c.get('user')

  if (!order) {
    return c.notFound()
  }

  const html = renderPage('shop/order-detail', {
    title: '注文詳細 - EC Shop',
    order,
    user,
    currentPath: `/shop/orders/${orderId}`,
    navType: 'shop',
  })
  return c.html(html)
})

export { shopRoutes }
