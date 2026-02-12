/**
 * Cost Entity Definitions
 * AWSコストの型定義
 */

export interface Cost {
  id: string
  timestamp: Date
  periodStart: string
  periodEnd: string
  service: string
  amount: number
  unit: string
}

export interface CostSummary {
  total: number
  unit: string
  periodStart: string
  periodEnd: string
  serviceCount: number
}
