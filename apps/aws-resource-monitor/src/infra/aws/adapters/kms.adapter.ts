/**
 * KMS Adapter
 * Wraps AWS KMS SDK operations
 */

import {
  KMSClient,
  ListKeysCommand,
  ListAliasesCommand,
  DescribeKeyCommand,
  type KeyMetadata,
  type AliasListEntry,
} from "@aws-sdk/client-kms"
import type { IKMSAdapter } from "./types.js"

export class KMSAdapter implements IKMSAdapter {
  private client: KMSClient

  constructor(region: string) {
    this.client = new KMSClient({ region })
  }

  async listKeys(): Promise<KeyMetadata[]> {
    const keys: KeyMetadata[] = []
    let marker: string | undefined

    do {
      const command = new ListKeysCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.Keys) {
        for (const key of response.Keys) {
          if (key.KeyId) {
            try {
              const describeCommand = new DescribeKeyCommand({ KeyId: key.KeyId })
              const describeResponse = await this.client.send(describeCommand)
              if (describeResponse.KeyMetadata) {
                keys.push(describeResponse.KeyMetadata)
              }
            } catch {
              // Skip keys we can't describe
            }
          }
        }
      }

      marker = response.NextMarker
    } while (marker)

    return keys
  }

  async listAliases(): Promise<AliasListEntry[]> {
    const aliases: AliasListEntry[] = []
    let marker: string | undefined

    do {
      const command = new ListAliasesCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.Aliases) {
        aliases.push(...response.Aliases)
      }

      marker = response.NextMarker
    } while (marker)

    return aliases
  }
}
