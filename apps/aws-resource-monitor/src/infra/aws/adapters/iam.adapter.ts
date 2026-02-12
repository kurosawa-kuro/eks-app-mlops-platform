/**
 * IAM Adapter
 * Wraps AWS IAM SDK operations
 */

import {
  IAMClient,
  ListRolesCommand,
  ListPoliciesCommand,
  type Role,
  type Policy,
} from "@aws-sdk/client-iam"
import type { IIAMAdapter } from "./types.js"

export class IAMAdapter implements IIAMAdapter {
  private client: IAMClient

  constructor(_region: string) {
    // IAM is a global service
    this.client = new IAMClient({ region: "us-east-1" })
  }

  async listRoles(): Promise<Role[]> {
    const roles: Role[] = []
    let marker: string | undefined

    do {
      const command = new ListRolesCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.Roles) {
        roles.push(...response.Roles)
      }

      marker = response.IsTruncated ? response.Marker : undefined
    } while (marker)

    return roles
  }

  async listPolicies(): Promise<Policy[]> {
    const policies: Policy[] = []
    let marker: string | undefined

    do {
      const command = new ListPoliciesCommand({
        Marker: marker,
        Scope: "Local", // Only customer managed policies
      })
      const response = await this.client.send(command)

      if (response.Policies) {
        policies.push(...response.Policies)
      }

      marker = response.IsTruncated ? response.Marker : undefined
    } while (marker)

    return policies
  }
}
