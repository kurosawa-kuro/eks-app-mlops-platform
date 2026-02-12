/**
 * ELB Adapter
 * Wraps AWS Elastic Load Balancing V2 SDK operations
 */

import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  type LoadBalancer,
  type TargetGroup,
} from "@aws-sdk/client-elastic-load-balancing-v2"
import type { IELBAdapter } from "./types.js"

export class ELBAdapter implements IELBAdapter {
  private client: ElasticLoadBalancingV2Client

  constructor(region: string) {
    this.client = new ElasticLoadBalancingV2Client({ region })
  }

  async describeLoadBalancers(): Promise<LoadBalancer[]> {
    const loadBalancers: LoadBalancer[] = []
    let marker: string | undefined

    do {
      const command = new DescribeLoadBalancersCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.LoadBalancers) {
        loadBalancers.push(...response.LoadBalancers)
      }

      marker = response.NextMarker
    } while (marker)

    return loadBalancers
  }

  async describeTargetGroups(): Promise<TargetGroup[]> {
    const targetGroups: TargetGroup[] = []
    let marker: string | undefined

    do {
      const command = new DescribeTargetGroupsCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.TargetGroups) {
        targetGroups.push(...response.TargetGroups)
      }

      marker = response.NextMarker
    } while (marker)

    return targetGroups
  }
}
