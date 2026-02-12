import { Hono } from 'hono'
import { resolve } from '../../container/index.js'

const devtoolHealth = new Hono()

devtoolHealth.get('/', async (c) => {
  const healthService = resolve('healthService')
  return c.json(await healthService.getStatus())
})

devtoolHealth.get('/status', async (c) => {
  const healthService = resolve('healthService')
  return c.json(await healthService.getStatus())
})

devtoolHealth.post('/postgres', async (c) => {
  const healthService = resolve('healthService')
  const result = await healthService.testPostgres()
  return c.json(result)
})

export { devtoolHealth }
