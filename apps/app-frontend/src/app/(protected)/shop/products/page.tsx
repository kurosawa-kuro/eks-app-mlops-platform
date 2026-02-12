'use client'

import { useEffect, useState } from 'react'
import type { Product } from '@/types/shop'
import { shopApi } from '@/lib/api/shop'
import { ProductCard } from '@/components/features/shop/ProductCard'
import { Spinner } from '@/components/ui/Spinner'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const result = await shopApi.getProducts()
        if (result.success && result.data) {
          setProducts(result.data)
        } else {
          setError(result.message || result.error || 'Failed to fetch products')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [])

  if (isLoading) {
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
          onClick={() => window.location.reload()}
          className="text-violet-500 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Products</h1>
      </div>

      {/* Cards */}
      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No products available
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
