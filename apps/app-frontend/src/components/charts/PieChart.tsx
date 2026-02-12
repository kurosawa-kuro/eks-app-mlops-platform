'use client'

import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PieChartProps {
  data: ChartData<'pie'>
  options?: ChartOptions<'pie'>
}

export function PieChart({ data, options }: PieChartProps) {
  const defaultOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
        },
      },
    },
    ...options,
  }

  return <Pie data={data} options={defaultOptions} />
}
