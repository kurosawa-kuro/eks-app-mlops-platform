/**
 * Cost Explorer Adapter
 * Wraps AWS Cost Explorer SDK operations
 */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer"
import type { ICostAdapter, CostResult } from "./types.js"

export class CostAdapter implements ICostAdapter {
  private client: CostExplorerClient

  constructor(_region: string = "us-east-1") {
    // Cost Explorer API is only available in us-east-1
    this.client = new CostExplorerClient({ region: "us-east-1" })
  }

  async getCostAndUsage(start: string, end: string): Promise<CostResult[]> {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: start,
        End: end,
      },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [
        {
          Type: "DIMENSION",
          Key: "SERVICE",
        },
      ],
    })

    const response = await this.client.send(command)
    const results: CostResult[] = []

    for (const result of response.ResultsByTime ?? []) {
      const periodStart = result.TimePeriod?.Start ?? ""
      const periodEnd = result.TimePeriod?.End ?? ""

      for (const group of result.Groups ?? []) {
        const service = group.Keys?.[0] ?? "Unknown"
        const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? "0")
        const unit = group.Metrics?.UnblendedCost?.Unit ?? "USD"

        results.push({
          periodStart,
          periodEnd,
          service,
          amount,
          unit,
        })
      }
    }

    results.sort((a, b) => b.amount - a.amount)

    return results
  }
}
