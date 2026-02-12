'use client'

import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Spinner } from '@/components/ui/Spinner'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'

export default function AnalyticsPage() {
  useAuth({ requiredRole: 'admin', redirectTo: '/dashboard' })
  const { data, isLoading, error, refetch } = useAnalytics()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Analytics</h1>
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={refetch}
                className="rounded bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { summary, by_category, daily_trend, by_region } = data

  // Format numbers
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('ja-JP').format(value)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Analytics</h1>
        <button
          onClick={refetch}
          className="rounded bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Transactions"
          value={formatNumber(summary.total_transactions)}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.total_revenue)}
        />
        <StatCard
          title="Avg Revenue"
          value={formatCurrency(summary.avg_revenue)}
        />
        <StatCard
          title="Unique Customers"
          value={formatNumber(summary.unique_customers)}
        />
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            labels={daily_trend.map(d => d.date)}
            datasets={[
              {
                label: 'Daily Revenue',
                data: daily_trend.map(d => d.daily_revenue),
                borderColor: 'rgb(168, 85, 247)',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
              },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              labels={by_category.map(c => c.category)}
              datasets={[
                {
                  label: 'Revenue',
                  data: by_category.map(c => c.total_revenue),
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Region Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Region</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              labels={by_region.map(r => r.region)}
              datasets={[
                {
                  label: 'Revenue',
                  data: by_region.map(r => r.total_revenue),
                },
              ]}
              horizontal
            />
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>Data source: {data.metadata.data_source}</p>
        <p>Generated at: {data.metadata.generated_at}</p>
      </div>
    </div>
  )
}
