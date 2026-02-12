'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/stores/cartStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export default function CartPage() {
  const router = useRouter()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const {
    cart,
    isLoading,
    error,
    fetchCart,
    removeItem,
    clearCart,
    checkout,
  } = useCartStore()

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  const handleRemove = async (productId: string) => {
    await removeItem(productId)
  }

  const handleClearCart = async () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      await clearCart()
    }
  }

  const handleCheckout = async () => {
    setIsCheckingOut(true)
    const result = await checkout()
    setIsCheckingOut(false)

    if (result.success && result.orderId) {
      router.push(`/shop/orders?new=${result.orderId}`)
    }
  }

  if (isLoading && !cart) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => fetchCart()}
          className="text-violet-500 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const cartItems = cart?.items || []
  const subtotal = cart?.subtotal || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Shopping Cart</h1>
        <Link
          href="/shop/products"
          className="text-violet-500 hover:underline"
        >
          Continue Shopping
        </Link>
      </div>

      {cartItems.length === 0 ? (
        <Card className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Your cart is empty</p>
          <Link href="/shop/products">
            <Button>Browse Products</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.productId} className="flex gap-4 p-4">
                {/* Product Image */}
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  {item.product?.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate text-gray-800 dark:text-gray-100">
                    {item.product?.name || 'Unknown Product'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {item.product ? formatPrice(item.product.price) : '-'} x {item.qty}
                  </p>
                  <p className="text-violet-500 font-semibold mt-1">
                    {formatPrice(item.itemTotal)}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemove(item.productId)}
                  className="text-red-500 hover:text-red-600 p-2"
                  title="Remove from cart"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </Card>
            ))}

            {/* Clear Cart Button */}
            <div className="text-right">
              <button
                onClick={handleClearCart}
                className="text-red-500 hover:underline text-sm"
                disabled={isLoading}
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Items ({cart?.itemCount || 0})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold text-gray-800 dark:text-gray-100">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={isCheckingOut || cartItems.length === 0}
                className="w-full"
              >
                {isCheckingOut ? 'Processing...' : 'Checkout'}
              </Button>

              <Link
                href="/shop/orders"
                className="block text-center text-violet-500 hover:underline text-sm mt-4"
              >
                View Order History
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
