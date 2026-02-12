/**
 * ECR Adapter
 * Wraps AWS ECR SDK operations
 */

import {
  ECRClient,
  DescribeRepositoriesCommand,
  ListTagsForResourceCommand,
  type Repository,
} from "@aws-sdk/client-ecr"
import type { IECRAdapter } from "./types.js"

export class ECRAdapter implements IECRAdapter {
  private client: ECRClient

  constructor(region: string) {
    this.client = new ECRClient({ region })
  }

  async describeRepositories(): Promise<Repository[]> {
    const repositories: Repository[] = []
    let nextToken: string | undefined

    do {
      const command = new DescribeRepositoriesCommand({ nextToken })
      const response = await this.client.send(command)

      if (response.repositories) {
        repositories.push(...response.repositories)
      }

      nextToken = response.nextToken
    } while (nextToken)

    return repositories
  }

  async listTagsForResource(resourceArn: string): Promise<Record<string, string>> {
    try {
      const command = new ListTagsForResourceCommand({ resourceArn })
      const response = await this.client.send(command)
      const tags: Record<string, string> = {}
      for (const tag of response.tags ?? []) {
        if (tag.Key) {
          tags[tag.Key] = tag.Value ?? ""
        }
      }
      return tags
    } catch {
      return {}
    }
  }
}
