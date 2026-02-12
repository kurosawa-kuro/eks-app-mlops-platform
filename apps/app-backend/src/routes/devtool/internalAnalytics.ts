import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { resolve } from '../../container/index.js'
import type { AnalyticsData, AnalyticsResult, CombinedAnalyticsData } from '../../domain/types/analytics.js'

const devtoolInternalAnalytics = new Hono()

/**
 * Creates a handler for analytics endpoints
 * DRY: Extracts common pattern of isEnabled check, fetch, and error handling
 *
 * @param extractor - Function to extract specific data from AnalyticsData
 * @returns MiddlewareHandler that handles the analytics request
 */
function createAnalyticsHandler<T>(
  extractor: (data: AnalyticsData) => T
): MiddlewareHandler {
  return async (c) => {
    const analyticsService = resolve('analyticsService')

    if (!analyticsService.isEnabled()) {
      return c.json({ error: 'Analytics API is not enabled' }, 503)
    }

    const result = await analyticsService.getAnalytics()

    if (!result.success) {
      const status = result.error === 'File not found' ? 404 : 503
      return c.json({ error: result.error }, status)
    }

    return c.json<AnalyticsResult<T>>({
      success: true,
      data: extractor(result.data!),
      cachedAt: result.cachedAt,
    })
  }
}

/** GET /internal/analytics - Returns all pre-computed analytics data */
devtoolInternalAnalytics.get('/', createAnalyticsHandler((d) => d))

/** GET /internal/analytics/summary - Returns summary statistics */
devtoolInternalAnalytics.get('/summary', createAnalyticsHandler((d) => d.summary))

/** GET /internal/analytics/by-category - Returns revenue by category */
devtoolInternalAnalytics.get('/by-category', createAnalyticsHandler((d) => d.by_category))

/** GET /internal/analytics/by-region - Returns revenue by region */
devtoolInternalAnalytics.get('/by-region', createAnalyticsHandler((d) => d.by_region))

/** GET /internal/analytics/daily-trend - Returns daily revenue trend */
devtoolInternalAnalytics.get('/daily-trend', createAnalyticsHandler((d) => d.daily_trend))

/** GET /internal/analytics/sentiment - Returns sentiment analysis results */
devtoolInternalAnalytics.get('/sentiment', async (c) => {
  const analyticsService = resolve('analyticsService')

  if (!analyticsService.isEnabled()) {
    return c.json({ error: 'Analytics API is not enabled' }, 503)
  }

  const result = await analyticsService.getSentiment()

  if (!result.success) {
    const status = result.error === 'File not found' ? 404 : 503
    return c.json({ error: result.error }, status)
  }

  return c.json({
    success: true,
    data: result.data,
    cachedAt: result.cachedAt,
  })
})

/** GET /internal/analytics/combined - Returns combined sales and sentiment data */
devtoolInternalAnalytics.get('/combined', async (c) => {
  const analyticsService = resolve('analyticsService')

  if (!analyticsService.isEnabled()) {
    return c.json({ error: 'Analytics API is not enabled' }, 503)
  }

  // Fetch both analytics and sentiment in parallel
  const [analyticsResult, sentimentResult] = await Promise.all([
    analyticsService.getAnalytics(),
    analyticsService.getSentiment(),
  ])

  // Check if analytics fetch succeeded
  if (!analyticsResult.success) {
    const status = analyticsResult.error === 'File not found' ? 404 : 503
    return c.json({ error: `Analytics: ${analyticsResult.error}` }, status)
  }

  // Check if sentiment fetch succeeded
  if (!sentimentResult.success) {
    const status = sentimentResult.error === 'File not found' ? 404 : 503
    return c.json({ error: `Sentiment: ${sentimentResult.error}` }, status)
  }

  const combinedData: CombinedAnalyticsData = {
    sales: analyticsResult.data!,
    sentiment: sentimentResult.data!,
    updatedAt: new Date().toISOString(),
  }

  return c.json({
    success: true,
    data: combinedData,
  })
})

export { devtoolInternalAnalytics }
