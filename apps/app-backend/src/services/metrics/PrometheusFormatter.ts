import type { IPrometheusFormatter } from '../../container/types.js'
import type { MetricsData } from '../../domain/types/health.js'

/**
 * Prometheus format output formatter
 * SRP: MetricsServiceから出力責務を分離
 *
 * 理由: メトリクス集計と出力フォーマットは異なる責務。
 * 将来的に他のフォーマット（JSON, CloudWatch等）追加時に拡張しやすい。
 */
export class PrometheusFormatter implements IPrometheusFormatter {
  format(metrics: MetricsData): string {
    const mem = process.memoryUsage()
    const uptime = process.uptime()

    return `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.httpRequestsTotal}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.httpErrorsTotal}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${uptime.toFixed(2)}

# HELP nodejs_heap_used_bytes Node.js heap used
# TYPE nodejs_heap_used_bytes gauge
nodejs_heap_used_bytes ${mem.heapUsed}

# HELP nodejs_heap_total_bytes Node.js heap total
# TYPE nodejs_heap_total_bytes gauge
nodejs_heap_total_bytes ${mem.heapTotal}

# HELP nodejs_rss_bytes Node.js RSS memory
# TYPE nodejs_rss_bytes gauge
nodejs_rss_bytes ${mem.rss}
`.trim()
  }
}
