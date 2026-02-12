/**
 * Analytics data types for internal endpoints
 */

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

export interface TopCustomer {
  customer_id: number
  transactions: number
  total_spend: number
  avg_order_value: number
}

export interface DiscountImpact {
  discount_pct: number
  transactions: number
  total_revenue: number
  avg_quantity: number
}

export interface AnalyticsMetadata {
  generated_at: string
  data_source: string
  version: string
}

export interface AnalyticsData {
  summary: AnalyticsSummary
  by_category: CategoryAnalytics[]
  by_region: RegionAnalytics[]
  daily_trend: DailyTrend[]
  top_customers: TopCustomer[]
  discount_impact: DiscountImpact[]
  metadata: AnalyticsMetadata
}

export interface AnalyticsResult<T> {
  success: boolean
  data?: T
  error?: string
  cachedAt?: string
}

/**
 * Sentiment analysis result types (from MLOps pipeline)
 */
export interface SentimentReviewResult {
  review_id: string
  product_id: string
  text: string
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
}

export interface SentimentSummary {
  positive: number
  negative: number
  neutral: number
}

export interface SentimentData {
  timestamp: string
  model: string
  total_reviews: number
  summary: SentimentSummary
  results: SentimentReviewResult[]
}

/**
 * Combined analytics response (sales + sentiment)
 */
export interface CombinedAnalyticsData {
  sales: AnalyticsData
  sentiment: SentimentData
  updatedAt: string
}
