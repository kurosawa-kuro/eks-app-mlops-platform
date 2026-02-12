'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface BarChartProps {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
  }[]
  title?: string
  horizontal?: boolean
}

export function BarChart({ labels, datasets, title, horizontal = false }: BarChartProps) {
  const colors = [
    'rgba(168, 85, 247, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(251, 146, 60, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ]

  const data = {
    labels,
    datasets: datasets.map((ds, index) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.backgroundColor || colors[index % colors.length],
      borderColor: ds.borderColor || colors[index % colors.length],
      borderWidth: 1,
    })),
  }

  const options = {
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#a1a1aa',
        },
      },
      title: {
        display: !!title,
        text: title,
        color: '#f4f4f5',
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#a1a1aa',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#a1a1aa',
        },
      },
    },
  }

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  )
}
