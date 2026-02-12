import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Logger } from 'pino'
import type { EnvConfig } from '../../container/types.js'
import type { AnalyticsResult } from '../../domain/types/analytics.js'
import { BaseStorageAdapter } from './BaseStorageAdapter.js'

/**
 * AWS S3 adapter for reading analytics files
 * Uses AWS SDK v3 with IRSA credentials in EKS
 */
export class S3Adapter extends BaseStorageAdapter {
  private client: S3Client

  constructor(env: EnvConfig, logger: Logger) {
    super(logger)
    this.client = new S3Client({
      region: env.AWS_REGION,
      // Credentials from IRSA in EKS, or local AWS credentials
    })
  }

  async getObject<T>(bucket: string, key: string): Promise<AnalyticsResult<T>> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })

      const response = await this.client.send(command)
      const bodyString = await response.Body?.transformToString()

      if (!bodyString) {
        return { success: false, error: 'Empty response body' }
      }

      const data = JSON.parse(bodyString) as T
      return this.successResult(data, response.LastModified?.toISOString())
    } catch (error) {
      const err = error as Error & { name?: string }

      if (err.name === 'NoSuchKey') {
        return this.notFoundResult(bucket, key)
      }

      return this.errorResult(err, bucket, key, 'S3 getObject failed')
    }
  }
}
