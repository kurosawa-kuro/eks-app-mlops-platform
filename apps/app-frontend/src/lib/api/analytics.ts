import { api } from './fetcher'
import type { ApiResponse } from '@/types/api'
import type {
  AnalyticsData,
  AnalyticsSummary,
  CategoryAnalytics,
  RegionAnalytics,
  DailyTrend,
  SentimentData,
} from '@/types/analytics'

export const analyticsApi = {
  /**
   * Get all analytics data
   */
  getAll: async (): Promise<ApiResponse<AnalyticsData>> => {
    return api.get<AnalyticsData>('/internal/analytics')
  },

  /**
   * Get summary only
   */
  getSummary: async (): Promise<ApiResponse<AnalyticsSummary>> => {
    return api.get<AnalyticsSummary>('/internal/analytics/summary')
  },

  /**
   * Get by category
   */
  getByCategory: async (): Promise<ApiResponse<CategoryAnalytics[]>> => {
    return api.get<CategoryAnalytics[]>('/internal/analytics/by-category')
  },

  /**
   * Get by region
   */
  getByRegion: async (): Promise<ApiResponse<RegionAnalytics[]>> => {
    return api.get<RegionAnalytics[]>('/internal/analytics/by-region')
  },

  /**
   * Get daily trend
   */
  getDailyTrend: async (): Promise<ApiResponse<DailyTrend[]>> => {
    return api.get<DailyTrend[]>('/internal/analytics/daily-trend')
  },

  /**
   * Get sentiment analysis
   */
  getSentiment: async (): Promise<ApiResponse<SentimentData>> => {
    return api.get<SentimentData>('/internal/analytics/sentiment')
  },

  /**
   * Get combined analytics + sentiment
   */
  getCombined: async (): Promise<ApiResponse<{
    analytics: AnalyticsData
    sentiment: SentimentData
  }>> => {
    return api.get<{
      analytics: AnalyticsData
      sentiment: SentimentData
    }>('/internal/analytics/combined')
  },
}
