'use client'

import type { SentimentResult } from '@/types/analytics'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface ReviewListProps {
  reviews: SentimentResult[]
}

const sentimentColors: Record<string, 'green' | 'gray' | 'red'> = {
  positive: 'green',
  neutral: 'gray',
  negative: 'red',
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
        No reviews available
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.review_id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-gray-800 dark:text-gray-100 mb-2">{review.text}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Product: {review.product_id}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge color={sentimentColors[review.sentiment]}>
                {review.sentiment}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Score: {(review.score * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
