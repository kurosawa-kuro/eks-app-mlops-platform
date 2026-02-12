'use client'

import { useAuth } from '@/hooks/useAuth'
import { useSentiment } from '@/hooks/useAnalytics'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { DoughnutChart } from '@/components/charts/DoughnutChart'

export default function SentimentPage() {
  useAuth({ requiredRole: 'admin', redirectTo: '/dashboard' })
  const { data, isLoading, error, refetch } = useSentiment()

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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Sentiment Analysis</h1>
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

  const { summary, results, total_reviews, model } = data

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge variant="success">Positive</Badge>
      case 'negative':
        return <Badge variant="danger">Negative</Badge>
      default:
        return <Badge variant="default">Neutral</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Sentiment Analysis</h1>
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
          title="Total Reviews"
          value={total_reviews}
        />
        <StatCard
          title="Positive"
          value={summary.positive}
          subtitle={`${((summary.positive / total_reviews) * 100).toFixed(1)}%`}
        />
        <StatCard
          title="Negative"
          value={summary.negative}
          subtitle={`${((summary.negative / total_reviews) * 100).toFixed(1)}%`}
        />
        <StatCard
          title="Neutral"
          value={summary.neutral}
          subtitle={`${((summary.neutral / total_reviews) * 100).toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sentiment Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DoughnutChart
              labels={['Positive', 'Negative', 'Neutral']}
              data={[summary.positive, summary.negative, summary.neutral]}
              colors={[
                'rgba(34, 197, 94, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(156, 163, 175, 0.8)',
              ]}
            />
          </CardContent>
        </Card>

        {/* Model Info */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-700/60 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Model</span>
                <span className="text-gray-800 dark:text-gray-100">{model}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-700/60 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Total Reviews</span>
                <span className="text-gray-800 dark:text-gray-100">{total_reviews}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-700/60 pb-2">
                <span className="text-gray-500 dark:text-gray-400">Positive Rate</span>
                <span className="text-green-400">
                  {((summary.positive / total_reviews) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Negative Rate</span>
                <span className="text-red-400">
                  {((summary.negative / total_reviews) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.slice(0, 10).map((review) => (
              <div
                key={review.review_id}
                className="flex items-start gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-4 last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSentimentBadge(review.sentiment)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Score: {(review.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{review.text}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Product ID: {review.product_id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
