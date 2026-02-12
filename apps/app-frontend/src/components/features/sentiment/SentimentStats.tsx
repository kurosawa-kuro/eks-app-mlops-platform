'use client'

import type { SentimentData } from '@/types/analytics'
import { DoughnutChart } from '@/components/charts/DoughnutChart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'

interface SentimentStatsProps {
  data: SentimentData
}

export function SentimentStats({ data }: SentimentStatsProps) {
  const { summary, total_reviews } = data

  const labels = ['Positive', 'Neutral', 'Negative']
  const chartData = [summary.positive, summary.neutral, summary.negative]
  const colors = [
    'rgba(16, 185, 129, 0.8)',
    'rgba(156, 163, 175, 0.8)',
    'rgba(239, 68, 68, 0.8)',
  ]

  const positiveRate = total_reviews > 0
    ? ((summary.positive / total_reviews) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Reviews"
          value={total_reviews.toString()}
        />
        <StatCard
          title="Positive Rate"
          value={`${positiveRate}%`}
          subtitle={`${summary.positive} reviews`}
        />
        <StatCard
          title="Model"
          value={data.model}
          subtitle={new Date(data.timestamp).toLocaleDateString('ja-JP')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="w-64 h-64">
            <DoughnutChart labels={labels} data={chartData} colors={colors} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
