'use client'

import { useState, useEffect, useCallback } from 'react'
import { analyticsApi } from '@/lib/api/analytics'
import type { AnalyticsData, SentimentData } from '@/types/analytics'

interface UseAnalyticsResult {
  data: AnalyticsData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Analytics data hook
 */
export function useAnalytics(): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await analyticsApi.getAll()
      if (result.success && result.data) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}

interface UseSentimentResult {
  data: SentimentData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Sentiment analysis data hook
 */
export function useSentiment(): UseSentimentResult {
  const [data, setData] = useState<SentimentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await analyticsApi.getSentiment()
      if (result.success && result.data) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch sentiment data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}
