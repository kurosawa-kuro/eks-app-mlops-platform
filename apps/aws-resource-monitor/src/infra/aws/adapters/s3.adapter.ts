/**
 * S3 Adapter
 * Wraps AWS S3 SDK operations
 */

import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  type Bucket,
} from "@aws-sdk/client-s3"
import type { IS3Adapter } from "./types.js"

export class S3Adapter implements IS3Adapter {
  private client: S3Client

  constructor(region: string) {
    this.client = new S3Client({ region })
  }

  async listBuckets(): Promise<Bucket[]> {
    const command = new ListBucketsCommand({})
    const response = await this.client.send(command)
    return response.Buckets ?? []
  }

  async getBucketLocation(bucketName: string): Promise<string | undefined> {
    try {
      const command = new GetBucketLocationCommand({ Bucket: bucketName })
      const response = await this.client.send(command)
      return response.LocationConstraint ?? "us-east-1"
    } catch {
      return undefined
    }
  }

  async getBucketTagging(bucketName: string): Promise<Record<string, string>> {
    try {
      const command = new GetBucketTaggingCommand({ Bucket: bucketName })
      const response = await this.client.send(command)
      const tags: Record<string, string> = {}
      for (const tag of response.TagSet ?? []) {
        if (tag.Key) {
          tags[tag.Key] = tag.Value ?? ""
        }
      }
      return tags
    } catch {
      return {}
    }
  }
}
