/**
 * ElastiCache Adapter
 * Wraps AWS ElastiCache SDK operations
 */

import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  type CacheCluster,
  type ReplicationGroup,
} from "@aws-sdk/client-elasticache"
import type { IElastiCacheAdapter } from "./types.js"

export class ElastiCacheAdapter implements IElastiCacheAdapter {
  private client: ElastiCacheClient

  constructor(region: string) {
    this.client = new ElastiCacheClient({ region })
  }

  async describeCacheClusters(): Promise<CacheCluster[]> {
    const clusters: CacheCluster[] = []
    let marker: string | undefined

    do {
      const command = new DescribeCacheClustersCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.CacheClusters) {
        clusters.push(...response.CacheClusters)
      }

      marker = response.Marker
    } while (marker)

    return clusters
  }

  async describeReplicationGroups(): Promise<ReplicationGroup[]> {
    const groups: ReplicationGroup[] = []
    let marker: string | undefined

    do {
      const command = new DescribeReplicationGroupsCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.ReplicationGroups) {
        groups.push(...response.ReplicationGroups)
      }

      marker = response.Marker
    } while (marker)

    return groups
  }
}
