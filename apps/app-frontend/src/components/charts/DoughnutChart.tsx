'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

interface DoughnutChartProps {
  labels: string[]
  data: number[]
  title?: string
  colors?: string[]
}

export function DoughnutChart({ labels, data, title, colors }: DoughnutChartProps) {
  const defaultColors = [
    'rgba(34, 197, 94, 0.8)',   // green
    'rgba(239, 68, 68, 0.8)',   // red
    'rgba(156, 163, 175, 0.8)', // gray
    'rgba(168, 85, 247, 0.8)',  // purple
    'rgba(59, 130, 246, 0.8)',  // blue
  ]

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors || defaultColors.slice(0, labels.length),
        borderColor: 'rgba(39, 39, 42, 1)',
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#a1a1aa',
          padding: 20,
        },
      },
      title: {
        display: !!title,
        text: title,
        color: '#f4f4f5',
      },
    },
  }

  return (
    <div className="h-64 w-full">
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
