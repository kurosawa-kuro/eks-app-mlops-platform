/**
 * RDS Adapter
 * Wraps AWS RDS SDK operations
 */

import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  type DBInstance,
  type DBCluster,
} from "@aws-sdk/client-rds"
import type { IRDSAdapter } from "./types.js"

export class RDSAdapter implements IRDSAdapter {
  private client: RDSClient

  constructor(region: string) {
    this.client = new RDSClient({ region })
  }

  async describeDBInstances(): Promise<DBInstance[]> {
    const instances: DBInstance[] = []
    let marker: string | undefined

    do {
      const command = new DescribeDBInstancesCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.DBInstances) {
        instances.push(...response.DBInstances)
      }

      marker = response.Marker
    } while (marker)

    return instances
  }

  async describeDBClusters(): Promise<DBCluster[]> {
    const clusters: DBCluster[] = []
    let marker: string | undefined

    do {
      const command = new DescribeDBClustersCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.DBClusters) {
        clusters.push(...response.DBClusters)
      }

      marker = response.Marker
    } while (marker)

    return clusters
  }
}
