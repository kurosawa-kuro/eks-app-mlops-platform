'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface LineChartProps {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor?: string
    backgroundColor?: string
    fill?: boolean
  }[]
  title?: string
}

export function LineChart({ labels, datasets, title }: LineChartProps) {
  const data = {
    labels,
    datasets: datasets.map((ds, index) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.borderColor || `hsl(${index * 60 + 270}, 70%, 60%)`,
      backgroundColor: ds.backgroundColor || `hsla(${index * 60 + 270}, 70%, 60%, 0.1)`,
      fill: ds.fill ?? true,
      tension: 0.4,
    })),
  }

  const options = {
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
      <Line data={data} options={options} />
    </div>
  )
}
