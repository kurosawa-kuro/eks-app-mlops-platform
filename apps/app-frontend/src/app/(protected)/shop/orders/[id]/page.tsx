'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Order } from '@/types/shop'
import { shopApi } from '@/lib/api/shop'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

const statusColors: Record<OrderStatus, 'gray' | 'blue' | 'yellow' | 'green' | 'red'> = {
  pending: 'yellow',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const result = await shopApi.getOrder(orderId)
        if (result.success && result.data) {
          setOrder(result.data)
        } else {
          setError(result.message || result.error || 'Order not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
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

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'Order not found'}</p>
        <Link href="/shop/orders" className="text-violet-500 hover:underline">
          Back to Orders
        </Link>
      </div>
    )
  }

  const status = (order.status as OrderStatus) || 'pending'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/shop/orders"
            className="text-violet-500 hover:underline text-sm mb-2 inline-block"
          >
            &larr; Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Order Details</h1>
        </div>
        <Badge color={statusColors[status]}>
          {statusLabels[status]}
        </Badge>
      </div>

      {/* Order Info */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Order ID</p>
            <p className="font-mono text-gray-800 dark:text-gray-100">{order.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Order Date</p>
            <p className="text-gray-800 dark:text-gray-100">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-bold text-violet-400">{formatPrice(order.total)}</p>
          </div>
        </div>
      </Card>

      {/* Order Items */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Order Items</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700/60">
          {order.items.map((item, index) => (
            <div key={index} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">{item.productName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatPrice(item.price)} x {item.qty}
                </p>
              </div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {formatPrice(item.price * item.qty)}
              </p>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-700 flex justify-between items-center">
          <span className="font-semibold text-gray-800 dark:text-gray-100">Total</span>
          <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatPrice(order.total)}</span>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href="/shop/products"
          className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
