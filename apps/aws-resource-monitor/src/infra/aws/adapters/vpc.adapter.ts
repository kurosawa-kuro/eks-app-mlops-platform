/**
 * VPC Adapter
 * Wraps AWS VPC-related EC2 SDK operations
 */

import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeInternetGatewaysCommand,
  DescribeRouteTablesCommand,
  DescribeVpcEndpointsCommand,
  type Vpc,
  type Subnet,
  type InternetGateway,
  type RouteTable,
  type VpcEndpoint,
} from "@aws-sdk/client-ec2"
import type { IVPCAdapter } from "./types.js"

export class VPCAdapter implements IVPCAdapter {
  private client: EC2Client

  constructor(region: string) {
    this.client = new EC2Client({ region })
  }

  async describeVpcs(): Promise<Vpc[]> {
    const vpcs: Vpc[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeVpcsCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.Vpcs) {
        vpcs.push(...response.Vpcs)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return vpcs
  }

  async describeSubnets(): Promise<Subnet[]> {
    const subnets: Subnet[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeSubnetsCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.Subnets) {
        subnets.push(...response.Subnets)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return subnets
  }

  async describeInternetGateways(): Promise<InternetGateway[]> {
    const igws: InternetGateway[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeInternetGatewaysCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.InternetGateways) {
        igws.push(...response.InternetGateways)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return igws
  }

  async describeRouteTables(): Promise<RouteTable[]> {
    const routeTables: RouteTable[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeRouteTablesCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.RouteTables) {
        routeTables.push(...response.RouteTables)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return routeTables
  }

  async describeVpcEndpoints(): Promise<VpcEndpoint[]> {
    const endpoints: VpcEndpoint[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeVpcEndpointsCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.VpcEndpoints) {
        endpoints.push(...response.VpcEndpoints)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return endpoints
  }
}
