/**
 * Route53 Adapter
 * Wraps AWS Route53 SDK operations
 */

import {
  Route53Client,
  ListHostedZonesCommand,
  ListResourceRecordSetsCommand,
  type HostedZone,
  type ResourceRecordSet,
} from "@aws-sdk/client-route-53"
import type { IRoute53Adapter } from "./types.js"

export class Route53Adapter implements IRoute53Adapter {
  private client: Route53Client

  constructor(_region: string) {
    // Route53 is a global service
    this.client = new Route53Client({ region: "us-east-1" })
  }

  async listHostedZones(): Promise<HostedZone[]> {
    const zones: HostedZone[] = []
    let marker: string | undefined

    do {
      const command = new ListHostedZonesCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.HostedZones) {
        zones.push(...response.HostedZones)
      }

      marker = response.IsTruncated ? response.NextMarker : undefined
    } while (marker)

    return zones
  }

  async listResourceRecordSets(hostedZoneId: string): Promise<ResourceRecordSet[]> {
    const records: ResourceRecordSet[] = []
    let nextRecordName: string | undefined
    let nextRecordType: string | undefined

    do {
      const command = new ListResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        StartRecordName: nextRecordName,
        StartRecordType: nextRecordType as any,
      })
      const response = await this.client.send(command)

      if (response.ResourceRecordSets) {
        records.push(...response.ResourceRecordSets)
      }

      if (response.IsTruncated) {
        nextRecordName = response.NextRecordName
        nextRecordType = response.NextRecordType
      } else {
        nextRecordName = undefined
        nextRecordType = undefined
      }
    } while (nextRecordName)

    return records
  }
}
