'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Product } from '@/types/shop'
import { useCartStore } from '@/stores/cartStore'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAdding(true)
    setMessage(null)

    const result = await addItem(product.id)

    if (result.success) {
      setMessage('Added!')
      setTimeout(() => setMessage(null), 2000)
    } else {
      setMessage(result.error || 'Failed')
    }

    setIsAdding(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  return (
    <div className="col-span-full sm:col-span-6 xl:col-span-3 bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden">
      <Link href={`/shop/products/${product.id}`} className="flex flex-col h-full">
        {/* Image */}
        <div className="aspect-[286/160] bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="grow flex flex-col p-5">
          {/* Card body */}
          <div className="grow">
            <header className="mb-3">
              <h3 className="text-lg text-gray-800 dark:text-gray-100 font-semibold">{product.name}</h3>
            </header>

            <div className="flex flex-wrap justify-between items-center mb-4">
              {product.category && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{product.category}</span>
              )}
              <div className="inline-flex text-sm font-medium bg-green-500/20 text-green-700 rounded-full text-center px-2 py-0.5">
                {formatPrice(product.price)}
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 line-clamp-2">{product.description}</p>
          </div>

          {/* Card footer */}
          <div>
            <button
              onClick={handleAddToCart}
              disabled={isAdding || product.stock === 0}
              className="btn-sm w-full bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? 'Adding...' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
            {message && (
              <p className={`text-xs mt-2 text-center font-medium ${
                message.includes('Failed') ? 'text-red-500' : 'text-green-500'
              }`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
