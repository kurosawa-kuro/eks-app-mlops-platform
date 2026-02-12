'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Product } from '@/types/shop'
import { shopApi } from '@/lib/api/shop'
import { useCartStore } from '@/stores/cartStore'
import { Spinner } from '@/components/ui/Spinner'

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [addMessage, setAddMessage] = useState<string | null>(null)

  const addItem = useCartStore((state) => state.addItem)
  const cartItemCount = useCartStore((state) => state.cart?.itemCount || 0)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const result = await shopApi.getProduct(productId)
        if (result.success && result.data) {
          setProduct(result.data)
        } else {
          setError(result.message || result.error || 'Product not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const handleAddToCart = async () => {
    if (!product) return

    setIsAdding(true)
    setAddMessage(null)

    const result = await addItem(product.id, qty)

    if (result.success) {
      setAddMessage(`Added ${qty} item(s) to cart!`)
      setTimeout(() => setAddMessage(null), 3000)
    } else {
      setAddMessage(result.error || 'Failed to add to cart')
    }

    setIsAdding(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'Product not found'}</p>
        <Link href="/shop/products" className="text-violet-500 hover:underline">
          Back to Products
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/shop/products" className="hover:text-gray-700 dark:hover:text-gray-200">
          Products
        </Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-gray-100">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden aspect-square">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
              <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            {product.category && (
              <span className="text-sm text-violet-500 mb-2 inline-block">{product.category}</span>
            )}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{product.name}</h1>
          </div>

          <p className="text-gray-600 dark:text-gray-300 text-lg">{product.description}</p>

          <div>
            <span className="text-4xl font-bold text-violet-500">
              {formatPrice(product.price)}
            </span>
          </div>

          {product.stock > 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600 dark:text-gray-400">Quantity:</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-gray-800 dark:text-gray-100">{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(product.stock, qty + 1))}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="btn w-full bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50"
              >
                {isAdding ? 'Adding...' : 'Add to Cart'}
              </button>

              {addMessage && (
                <p className={`text-sm text-center ${
                  addMessage.includes('Failed') ? 'text-red-500' : 'text-green-500'
                }`}>
                  {addMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-5 text-center text-red-500">
              Out of Stock
            </div>
          )}

          {/* Quick Links */}
          <div className="flex gap-4">
            <Link
              href="/shop/cart"
              className="text-violet-500 hover:underline flex items-center gap-1 text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
                <path d="M2.5 1a1 1 0 0 0 0 2h.191l1.328 5.313A2.5 2.5 0 0 0 6.473 10.5h4.054a2.5 2.5 0 0 0 2.454-2.03l.96-4.8A1 1 0 0 0 12.96 2.5H4.691L4.5 1.675A1 1 0 0 0 3.52 1H2.5ZM6 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
              View Cart ({cartItemCount})
            </Link>
            <Link
              href="/shop/products"
              className="text-gray-500 dark:text-gray-400 hover:underline text-sm"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
