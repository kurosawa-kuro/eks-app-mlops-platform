/**
 * Auto Scaling Adapter
 * Wraps AWS Auto Scaling SDK operations
 */

import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  type AutoScalingGroup,
} from "@aws-sdk/client-auto-scaling"
import type { IAutoScalingAdapter } from "./types.js"

export class AutoScalingAdapter implements IAutoScalingAdapter {
  private client: AutoScalingClient

  constructor(region: string) {
    this.client = new AutoScalingClient({ region })
  }

  async describeAutoScalingGroups(): Promise<AutoScalingGroup[]> {
    const groups: AutoScalingGroup[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeAutoScalingGroupsCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.AutoScalingGroups) {
        groups.push(...response.AutoScalingGroups)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return groups
  }
}
