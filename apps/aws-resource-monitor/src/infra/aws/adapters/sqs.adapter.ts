/**
 * SQS Adapter
 * Wraps AWS SQS SDK operations
 */

import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs"
import type { ISQSAdapter, SQSQueueInfo } from "./types.js"

export class SQSAdapter implements ISQSAdapter {
  private client: SQSClient

  constructor(region: string) {
    this.client = new SQSClient({ region })
  }

  async listQueues(): Promise<SQSQueueInfo[]> {
    const queues: SQSQueueInfo[] = []
    let nextToken: string | undefined

    do {
      const command = new ListQueuesCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.QueueUrls) {
        for (const queueUrl of response.QueueUrls) {
          try {
            const attrCommand = new GetQueueAttributesCommand({
              QueueUrl: queueUrl,
              AttributeNames: ["All"],
            })
            const attrResponse = await this.client.send(attrCommand)

            const queueName = queueUrl.split("/").pop() ?? ""

            queues.push({
              queueUrl,
              queueName,
              attributes: attrResponse.Attributes ?? {},
            })
          } catch {
            const queueName = queueUrl.split("/").pop() ?? ""
            queues.push({
              queueUrl,
              queueName,
              attributes: {},
            })
          }
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    return queues
  }
}
