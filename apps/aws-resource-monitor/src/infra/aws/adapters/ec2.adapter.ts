/**
 * EC2 Adapter
 * Wraps AWS EC2 SDK operations
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeNatGatewaysCommand,
  DescribeAddressesCommand,
  DescribeVolumesCommand,
  DescribeSecurityGroupsCommand,
  DescribeKeyPairsCommand,
  GetConsoleOutputCommand,
  type Instance,
  type Volume,
  type SecurityGroup,
  type KeyPairInfo,
  type NatGateway,
} from "@aws-sdk/client-ec2"
import type { IEC2Adapter, ElasticIpInfo, ConsoleOutputInfo } from "./types.js"
import { extractTags } from "./types.js"

export class EC2Adapter implements IEC2Adapter {
  private client: EC2Client

  constructor(region: string) {
    this.client = new EC2Client({ region })
  }

  async describeInstances(): Promise<Instance[]> {
    const instances: Instance[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeInstancesCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      for (const reservation of response.Reservations ?? []) {
        if (reservation.Instances) {
          instances.push(...reservation.Instances)
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    return instances
  }

  async describeNatGateways(): Promise<NatGateway[]> {
    const natGateways: NatGateway[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeNatGatewaysCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.NatGateways) {
        natGateways.push(...response.NatGateways)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return natGateways
  }

  async describeElasticIps(): Promise<ElasticIpInfo[]> {
    const command = new DescribeAddressesCommand({})
    const response = await this.client.send(command)

    return (response.Addresses ?? []).map((addr) => ({
      allocationId: addr.AllocationId,
      publicIp: addr.PublicIp,
      associationId: addr.AssociationId,
      instanceId: addr.InstanceId,
      domain: addr.Domain,
      tags: extractTags(addr.Tags),
    }))
  }

  async describeVolumes(): Promise<Volume[]> {
    const volumes: Volume[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeVolumesCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.Volumes) {
        volumes.push(...response.Volumes)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return volumes
  }

  async describeSecurityGroups(): Promise<SecurityGroup[]> {
    const securityGroups: SecurityGroup[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeSecurityGroupsCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.SecurityGroups) {
        securityGroups.push(...response.SecurityGroups)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return securityGroups
  }

  async describeKeyPairs(): Promise<KeyPairInfo[]> {
    const command = new DescribeKeyPairsCommand({})
    const response = await this.client.send(command)
    return response.KeyPairs ?? []
  }

  async describeInstancesByIds(instanceIds: string[]): Promise<Instance[]> {
    if (instanceIds.length === 0) {
      return []
    }

    const instances: Instance[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeInstancesCommand({
        InstanceIds: instanceIds,
        NextToken: nextToken,
      })
      const response = await this.client.send(command)

      for (const reservation of response.Reservations ?? []) {
        if (reservation.Instances) {
          instances.push(...reservation.Instances)
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    return instances
  }

  async getConsoleOutput(instanceId: string): Promise<ConsoleOutputInfo | null> {
    try {
      const command = new GetConsoleOutputCommand({
        InstanceId: instanceId,
        Latest: true,
      })
      const response = await this.client.send(command)

      let output: string | null = null
      if (response.Output) {
        output = Buffer.from(response.Output, "base64").toString("utf-8")
      }

      return {
        instanceId,
        output,
        timestamp: response.Timestamp ?? null,
      }
    } catch {
      return null
    }
  }
}
