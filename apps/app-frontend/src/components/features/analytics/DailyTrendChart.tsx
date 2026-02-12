'use client'

import type { DailyTrend } from '@/types/analytics'
import { LineChart } from '@/components/charts/LineChart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface DailyTrendChartProps {
  data: DailyTrend[]
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  const labels = data.map((d) => d.date)
  const datasets = [
    {
      label: 'Daily Revenue',
      data: data.map((d) => d.daily_revenue),
      borderColor: 'rgb(139, 92, 246)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <LineChart labels={labels} datasets={datasets} />
      </CardContent>
    </Card>
  )
}
