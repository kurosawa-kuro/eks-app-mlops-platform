'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Order, OrderStatus } from '@/types/shop'
import { shopApi } from '@/lib/api/shop'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

const statusBadgeVariant: Record<OrderStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const newOrderId = searchParams.get('new')

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(newOrderId)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const result = await shopApi.getOrders()
        if (result.success && result.data) {
          setOrders(result.data)
        } else {
          setError(result.message || result.error || 'Failed to fetch orders')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Order History</h1>
        <Link
          href="/shop/products"
          className="text-violet-500 hover:underline text-sm"
        >
          Continue Shopping
        </Link>
      </div>

      {/* New Order Success Message */}
      {newOrderId && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">Order placed successfully!</span>
          </div>
          <p className="text-green-500/80 text-sm mt-1">
            Order ID: {newOrderId}
          </p>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No orders yet</p>
          <Link href="/shop/products" className="text-violet-500 hover:underline">
            Start Shopping
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              {/* Order Header */}
              <button
                onClick={() =>
                  setExpandedOrder(expandedOrder === order.id ? null : order.id)
                }
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant={statusBadgeVariant[order.status]}>
                    {statusLabels[order.status]}
                  </Badge>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{formatPrice(order.total)}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${
                      expandedOrder === order.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Order Details (Expanded) */}
              {expandedOrder === order.id && (
                <div className="border-t border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/30 px-5 py-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100">{item.productName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(item.price)} x {item.qty}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          {formatPrice(item.price * item.qty)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 flex justify-between items-center">
                    <Link
                      href={`/shop/orders/${order.id}`}
                      className="text-violet-500 hover:underline text-sm"
                    >
                      View Full Details
                    </Link>
                    <div>
                      <span className="font-semibold text-gray-500 dark:text-gray-400 mr-2">Total:</span>
                      <span className="font-bold text-lg text-gray-800 dark:text-gray-100">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
