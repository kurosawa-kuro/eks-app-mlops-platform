import type { Logger } from 'pino'
import type { AnalyticsResult, AnalyticsData, SentimentData } from '../../domain/types/analytics.js'
import { BaseStorageAdapter } from './BaseStorageAdapter.js'

/**
 * Mock S3 adapter for local development
 * Returns sample data for testing
 */
export class MockS3Adapter extends BaseStorageAdapter {
  constructor(logger: Logger) {
    super(logger)
  }

  async getObject<T>(bucket: string, key: string): Promise<AnalyticsResult<T>> {
    this.logger.debug({ bucket, key }, 'Mock S3: getObject called')

    // Return appropriate mock data based on key
    if (key.includes('sentiment')) {
      const mockData = this.getMockSentimentData()
      return this.successResult(mockData as T)
    }

    // Default to analytics data
    const mockData = this.getMockAnalyticsData()
    return this.successResult(mockData as T)
  }

  private getMockAnalyticsData(): AnalyticsData {
    return {
      summary: {
        total_transactions: 5000,
        total_revenue: 1234567.89,
        avg_revenue: 246.91,
        min_revenue: 5.0,
        max_revenue: 4500.0,
        total_quantity: 50000,
        unique_customers: 2500,
      },
      by_category: [
        {
          category: 'electronics',
          transactions: 1200,
          total_revenue: 450000.0,
          avg_revenue: 375.0,
          total_quantity: 3600,
        },
        {
          category: 'clothing',
          transactions: 1500,
          total_revenue: 300000.0,
          avg_revenue: 200.0,
          total_quantity: 7500,
        },
        {
          category: 'food',
          transactions: 1000,
          total_revenue: 200000.0,
          avg_revenue: 200.0,
          total_quantity: 20000,
        },
        {
          category: 'books',
          transactions: 800,
          total_revenue: 160000.0,
          avg_revenue: 200.0,
          total_quantity: 8000,
        },
        {
          category: 'home',
          transactions: 500,
          total_revenue: 124567.89,
          avg_revenue: 249.14,
          total_quantity: 10900,
        },
      ],
      by_region: [
        { region: 'north', transactions: 1300, total_revenue: 320000.0, avg_revenue: 246.15 },
        { region: 'south', transactions: 1250, total_revenue: 310000.0, avg_revenue: 248.0 },
        { region: 'east', transactions: 1200, total_revenue: 304567.89, avg_revenue: 253.81 },
        { region: 'west', transactions: 1250, total_revenue: 300000.0, avg_revenue: 240.0 },
      ],
      daily_trend: [
        { date: '2024-01-01', transactions: 100, daily_revenue: 25000.0, avg_unit_price: 250.0 },
        { date: '2024-01-02', transactions: 120, daily_revenue: 30000.0, avg_unit_price: 250.0 },
        { date: '2024-01-03', transactions: 110, daily_revenue: 27500.0, avg_unit_price: 250.0 },
      ],
      top_customers: [
        { customer_id: 1234, transactions: 50, total_spend: 25000.0, avg_order_value: 500.0 },
        { customer_id: 5678, transactions: 45, total_spend: 22500.0, avg_order_value: 500.0 },
        { customer_id: 9012, transactions: 40, total_spend: 20000.0, avg_order_value: 500.0 },
      ],
      discount_impact: [
        { discount_pct: 0, transactions: 2000, total_revenue: 600000.0, avg_quantity: 10 },
        { discount_pct: 5, transactions: 1000, total_revenue: 285000.0, avg_quantity: 11 },
        { discount_pct: 10, transactions: 1000, total_revenue: 270000.0, avg_quantity: 12 },
        { discount_pct: 15, transactions: 500, total_revenue: 42500.0, avg_quantity: 13 },
        { discount_pct: 20, transactions: 500, total_revenue: 37067.89, avg_quantity: 14 },
      ],
      metadata: {
        generated_at: new Date().toISOString(),
        data_source: 'mock_data',
        version: '1.0.0',
      },
    }
  }

  private getMockSentimentData(): SentimentData {
    return {
      timestamp: new Date().toISOString(),
      model: 'jarvisx17/japanese-sentiment-analysis',
      total_reviews: 100,
      summary: {
        positive: 55,
        negative: 20,
        neutral: 25,
      },
      results: [
        {
          review_id: '1',
          product_id: 'prod_001',
          text: 'とても良い商品でした。また購入したいです。',
          sentiment: 'positive',
          score: 0.9234,
        },
        {
          review_id: '2',
          product_id: 'prod_002',
          text: '期待していたほどではありませんでした。',
          sentiment: 'negative',
          score: 0.7812,
        },
        {
          review_id: '3',
          product_id: 'prod_001',
          text: '普通の商品です。可もなく不可もなく。',
          sentiment: 'neutral',
          score: 0.6543,
        },
        {
          review_id: '4',
          product_id: 'prod_003',
          text: '配送が早くて助かりました。商品も満足です。',
          sentiment: 'positive',
          score: 0.8901,
        },
        {
          review_id: '5',
          product_id: 'prod_002',
          text: '品質に問題がありました。返品しました。',
          sentiment: 'negative',
          score: 0.8567,
        },
      ],
    }
  }
}
