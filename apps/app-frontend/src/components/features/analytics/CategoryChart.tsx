'use client'

import type { CategoryAnalytics } from '@/types/analytics'
import { BarChart } from '@/components/charts/BarChart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface CategoryChartProps {
  data: CategoryAnalytics[]
}

export function CategoryChart({ data }: CategoryChartProps) {
  const labels = data.map((d) => d.category)
  const datasets = [
    {
      label: 'Revenue',
      data: data.map((d) => d.total_revenue),
      backgroundColor: [
        'rgba(139, 92, 246, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderColor: [
        'rgb(139, 92, 246)',
        'rgb(59, 130, 246)',
        'rgb(16, 185, 129)',
        'rgb(245, 158, 11)',
        'rgb(239, 68, 68)',
      ],
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart labels={labels} datasets={datasets} />
      </CardContent>
    </Card>
  )
}
