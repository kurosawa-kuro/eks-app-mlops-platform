/**
 * CloudWatch Logs Adapter
 * Wraps AWS CloudWatch Logs SDK operations
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  ListTagsForResourceCommand,
  type LogGroup,
} from "@aws-sdk/client-cloudwatch-logs"
import type { ICloudWatchLogsAdapter } from "./types.js"

export class CloudWatchLogsAdapter implements ICloudWatchLogsAdapter {
  private client: CloudWatchLogsClient

  constructor(region: string) {
    this.client = new CloudWatchLogsClient({ region })
  }

  async describeLogGroups(): Promise<LogGroup[]> {
    const logGroups: LogGroup[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeLogGroupsCommand({ nextToken })
      const response = await this.client.send(command)

      if (response.logGroups) {
        logGroups.push(...response.logGroups)
      }

      nextToken = response.nextToken
    } while (nextToken)

    return logGroups
  }

  async listTagsForResource(resourceArn: string): Promise<Record<string, string>> {
    try {
      const command = new ListTagsForResourceCommand({ resourceArn })
      const response = await this.client.send(command)
      return response.tags ?? {}
    } catch {
      return {}
    }
  }
}
