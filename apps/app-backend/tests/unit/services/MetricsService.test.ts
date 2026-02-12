import { MetricsService, PrometheusFormatter } from '../../../src/services/metrics/index.js'

describe('MetricsService', () => {
  let metricsService: MetricsService
  let prometheusFormatter: PrometheusFormatter

  beforeEach(() => {
    prometheusFormatter = new PrometheusFormatter()
    metricsService = new MetricsService(prometheusFormatter)
  })

  describe('recordRequest', () => {
    it('should increment http requests counter', () => {
      metricsService.recordRequest()
      const metrics = metricsService.getMetrics()
      expect(metrics.httpRequestsTotal).toBe(1)
    })

    it('should increment counter multiple times', () => {
      metricsService.recordRequest()
      metricsService.recordRequest()
      metricsService.recordRequest()
      const metrics = metricsService.getMetrics()
      expect(metrics.httpRequestsTotal).toBe(3)
    })
  })

  describe('recordError', () => {
    it('should increment http errors counter', () => {
      metricsService.recordError()
      const metrics = metricsService.getMetrics()
      expect(metrics.httpErrorsTotal).toBe(1)
    })

    it('should increment error counter multiple times', () => {
      metricsService.recordError()
      metricsService.recordError()
      const metrics = metricsService.getMetrics()
      expect(metrics.httpErrorsTotal).toBe(2)
    })
  })

  describe('getMetrics', () => {
    it('should return initial metrics with zero values', () => {
      const metrics = metricsService.getMetrics()
      expect(metrics.httpRequestsTotal).toBe(0)
      expect(metrics.httpErrorsTotal).toBe(0)
    })

    it('should return correct metrics after recording', () => {
      metricsService.recordRequest()
      metricsService.recordRequest()
      metricsService.recordError()
      const metrics = metricsService.getMetrics()
      expect(metrics.httpRequestsTotal).toBe(2)
      expect(metrics.httpErrorsTotal).toBe(1)
    })
  })

  describe('getPrometheusOutput', () => {
    it('should return prometheus formatted output', () => {
      const output = metricsService.getPrometheusOutput()
      expect(typeof output).toBe('string')
    })

    it('should contain http_requests_total metric', () => {
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('# HELP http_requests_total')
      expect(output).toContain('# TYPE http_requests_total counter')
      expect(output).toContain('http_requests_total')
    })

    it('should contain http_errors_total metric', () => {
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('# HELP http_errors_total')
      expect(output).toContain('# TYPE http_errors_total counter')
      expect(output).toContain('http_errors_total')
    })

    it('should contain process_uptime_seconds metric', () => {
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('# HELP process_uptime_seconds')
      expect(output).toContain('# TYPE process_uptime_seconds gauge')
      expect(output).toContain('process_uptime_seconds')
    })

    it('should contain nodejs heap metrics', () => {
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('nodejs_heap_used_bytes')
      expect(output).toContain('nodejs_heap_total_bytes')
    })

    it('should contain nodejs rss metric', () => {
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('nodejs_rss_bytes')
    })

    it('should reflect recorded requests in output', () => {
      metricsService.recordRequest()
      metricsService.recordRequest()
      const output = metricsService.getPrometheusOutput()
      expect(output).toContain('http_requests_total 2')
    })
  })
})
