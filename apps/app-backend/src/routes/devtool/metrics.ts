import { Hono } from 'hono'
import { resolve } from '../../container/index.js'

const devtoolMetrics = new Hono()

devtoolMetrics.get('/', (c) => {
  const metricsService = resolve('metricsService')
  return c.text(metricsService.getPrometheusOutput(), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  })
})

export { devtoolMetrics }
