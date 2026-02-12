/**
 * ACM Adapter
 * Wraps AWS Certificate Manager SDK operations
 */

import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
  type CertificateSummary,
  type CertificateDetail,
} from "@aws-sdk/client-acm"
import type { IACMAdapter } from "./types.js"

export class ACMAdapter implements IACMAdapter {
  private client: ACMClient

  constructor(region: string) {
    this.client = new ACMClient({ region })
  }

  async listCertificates(): Promise<CertificateSummary[]> {
    const certificates: CertificateSummary[] = []
    let nextToken: string | undefined

    do {
      const command = new ListCertificatesCommand({ NextToken: nextToken })
      const response = await this.client.send(command)

      if (response.CertificateSummaryList) {
        certificates.push(...response.CertificateSummaryList)
      }

      nextToken = response.NextToken
    } while (nextToken)

    return certificates
  }

  async describeCertificate(arn: string): Promise<CertificateDetail | null> {
    try {
      const command = new DescribeCertificateCommand({ CertificateArn: arn })
      const response = await this.client.send(command)
      return response.Certificate ?? null
    } catch {
      return null
    }
  }
}
