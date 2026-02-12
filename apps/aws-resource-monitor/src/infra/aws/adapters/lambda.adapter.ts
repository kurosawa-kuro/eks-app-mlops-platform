/**
 * Lambda Adapter
 * Wraps AWS Lambda SDK operations
 */

import {
  LambdaClient,
  ListFunctionsCommand,
  type FunctionConfiguration,
} from "@aws-sdk/client-lambda"
import type { ILambdaAdapter } from "./types.js"

export class LambdaAdapter implements ILambdaAdapter {
  private client: LambdaClient

  constructor(region: string) {
    this.client = new LambdaClient({ region })
  }

  async listFunctions(): Promise<FunctionConfiguration[]> {
    const functions: FunctionConfiguration[] = []
    let marker: string | undefined

    do {
      const command = new ListFunctionsCommand({ Marker: marker })
      const response = await this.client.send(command)

      if (response.Functions) {
        functions.push(...response.Functions)
      }

      marker = response.NextMarker
    } while (marker)

    return functions
  }
}
