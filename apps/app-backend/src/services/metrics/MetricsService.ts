import type { IMetricsService, IPrometheusFormatter } from '../../container/types.js'
import type { MetricsData } from '../../domain/types/health.js'

/**
 * Metrics service for request and error tracking
 * Stores metrics in memory (not persistent across restarts)
 *
 * SRP: 集計責務のみを担当。出力フォーマットはPrometheusFormatterに委譲。
 */
export class MetricsService implements IMetricsService {
  private httpRequestsTotal = 0
  private httpErrorsTotal = 0

  constructor(
    private readonly prometheusFormatter: IPrometheusFormatter,
  ) {}

  recordRequest(): void {
    this.httpRequestsTotal++
  }

  recordError(): void {
    this.httpErrorsTotal++
  }

  getMetrics(): MetricsData {
    return {
      httpRequestsTotal: this.httpRequestsTotal,
      httpErrorsTotal: this.httpErrorsTotal,
    }
  }

  getPrometheusOutput(): string {
    return this.prometheusFormatter.format(this.getMetrics())
  }
}
