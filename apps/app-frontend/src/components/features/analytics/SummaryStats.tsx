'use client'

import type { AnalyticsSummary } from '@/types/analytics'
import { StatCard } from '@/components/ui/StatCard'

interface SummaryStatsProps {
  summary: AnalyticsSummary
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ja-JP').format(value)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Revenue"
        value={formatCurrency(summary.total_revenue)}
        subtitle={`Avg: ${formatCurrency(summary.avg_revenue)}`}
      />
      <StatCard
        title="Total Transactions"
        value={formatNumber(summary.total_transactions)}
      />
      <StatCard
        title="Total Quantity"
        value={formatNumber(summary.total_quantity)}
      />
      <StatCard
        title="Unique Customers"
        value={formatNumber(summary.unique_customers)}
      />
    </div>
  )
}
