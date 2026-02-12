/**
 * Kinesis Firehose Adapter
 * Wraps AWS Kinesis Firehose SDK operations
 */

import {
  FirehoseClient,
  ListDeliveryStreamsCommand,
  DescribeDeliveryStreamCommand,
  ListTagsForDeliveryStreamCommand,
  type DeliveryStreamDescription,
} from "@aws-sdk/client-firehose"
import type { IFirehoseAdapter } from "./types.js"

export class FirehoseAdapter implements IFirehoseAdapter {
  private client: FirehoseClient

  constructor(region: string) {
    this.client = new FirehoseClient({ region })
  }

  async listDeliveryStreams(): Promise<string[]> {
    const streams: string[] = []
    let exclusiveStartDeliveryStreamName: string | undefined

    do {
      const command = new ListDeliveryStreamsCommand({
        ExclusiveStartDeliveryStreamName: exclusiveStartDeliveryStreamName,
      })
      const response = await this.client.send(command)

      if (response.DeliveryStreamNames) {
        streams.push(...response.DeliveryStreamNames)
      }

      if (response.HasMoreDeliveryStreams && response.DeliveryStreamNames?.length) {
        exclusiveStartDeliveryStreamName = response.DeliveryStreamNames[response.DeliveryStreamNames.length - 1]
      } else {
        exclusiveStartDeliveryStreamName = undefined
      }
    } while (exclusiveStartDeliveryStreamName)

    return streams
  }

  async describeDeliveryStream(streamName: string): Promise<DeliveryStreamDescription | null> {
    try {
      const command = new DescribeDeliveryStreamCommand({
        DeliveryStreamName: streamName,
      })
      const response = await this.client.send(command)
      return response.DeliveryStreamDescription ?? null
    } catch {
      return null
    }
  }

  async listTagsForDeliveryStream(streamName: string): Promise<Record<string, string>> {
    try {
      const command = new ListTagsForDeliveryStreamCommand({
        DeliveryStreamName: streamName,
      })
      const response = await this.client.send(command)
      const tags: Record<string, string> = {}
      for (const tag of response.Tags ?? []) {
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
