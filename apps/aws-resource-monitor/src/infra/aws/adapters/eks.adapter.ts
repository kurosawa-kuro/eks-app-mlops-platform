/**
 * EKS Adapter
 * Wraps AWS EKS SDK operations
 */

import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
  ListAddonsCommand,
  DescribeAddonCommand,
  type Cluster,
  type Nodegroup,
  type Addon,
} from "@aws-sdk/client-eks"
import type { IEKSAdapter } from "./types.js"

export class EKSAdapter implements IEKSAdapter {
  private client: EKSClient

  constructor(region: string) {
    this.client = new EKSClient({ region })
  }

  async listClusters(): Promise<string[]> {
    const clusters: string[] = []
    let nextToken: string | undefined

    do {
      const command = new ListClustersCommand({ nextToken })
      const response = await this.client.send(command)

      if (response.clusters) {
        clusters.push(...response.clusters)
      }

      nextToken = response.nextToken
    } while (nextToken)

    return clusters
  }

  async describeCluster(name: string): Promise<Cluster | null> {
    try {
      const command = new DescribeClusterCommand({ name })
      const response = await this.client.send(command)
      return response.cluster ?? null
    } catch {
      return null
    }
  }

  async listNodegroups(clusterName: string): Promise<string[]> {
    const nodegroups: string[] = []
    let nextToken: string | undefined

    do {
      const command = new ListNodegroupsCommand({
        clusterName,
        nextToken,
      })
      const response = await this.client.send(command)

      if (response.nodegroups) {
        nodegroups.push(...response.nodegroups)
      }

      nextToken = response.nextToken
    } while (nextToken)

    return nodegroups
  }

  async describeNodegroup(clusterName: string, nodegroupName: string): Promise<Nodegroup | null> {
    try {
      const command = new DescribeNodegroupCommand({
        clusterName,
        nodegroupName,
      })
      const response = await this.client.send(command)
      return response.nodegroup ?? null
    } catch {
      return null
    }
  }

  async listAddons(clusterName: string): Promise<string[]> {
    const addons: string[] = []
    let nextToken: string | undefined

    do {
      const command = new ListAddonsCommand({
        clusterName,
        nextToken,
      })
      const response = await this.client.send(command)

      if (response.addons) {
        addons.push(...response.addons)
      }

      nextToken = response.nextToken
    } while (nextToken)

    return addons
  }

  async describeAddon(clusterName: string, addonName: string): Promise<Addon | null> {
    try {
      const command = new DescribeAddonCommand({
        clusterName,
        addonName,
      })
      const response = await this.client.send(command)
      return response.addon ?? null
    } catch {
      return null
    }
  }
}
