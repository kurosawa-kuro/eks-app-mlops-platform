export interface AnalyticsSummary {
  total_transactions: number
  total_revenue: number
  avg_revenue: number
  min_revenue: number
  max_revenue: number
  total_quantity: number
  unique_customers: number
}

export interface CategoryAnalytics {
  category: string
  transactions: number
  total_revenue: number
  avg_revenue: number
  total_quantity: number
}

export interface RegionAnalytics {
  region: string
  transactions: number
  total_revenue: number
  avg_revenue: number
}

export interface DailyTrend {
  date: string
  transactions: number
  daily_revenue: number
  avg_unit_price: number
}

export interface AnalyticsData {
  summary: AnalyticsSummary
  by_category: CategoryAnalytics[]
  by_region: RegionAnalytics[]
  daily_trend: DailyTrend[]
  metadata: {
    generated_at: string
    data_source: string
    version: string
  }
}

export interface SentimentResult {
  review_id: string
  product_id: string
  text: string
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
}

export interface SentimentData {
  timestamp: string
  model: string
  total_reviews: number
  summary: {
    positive: number
    negative: number
    neutral: number
  }
  results: SentimentResult[]
}
