import { describe, it, expect } from 'vitest'
import { createHealthRoutes } from '../../../src/presentation/routes/api/health.js'
import type { RouteContext } from '../../../src/presentation/routes/types.js'

describe('createHealthRoutes', () => {
  const mockContext: RouteContext = {
    appConfig: {
      projectName: 'test-app'
    }
  } as RouteContext

  it('should return health status', async () => {
    const app = createHealthRoutes(mockContext)
    const res = await app.request('/health')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
  })

  it('should return app info', async () => {
    const app = createHealthRoutes(mockContext)
    const res = await app.request('/info')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.name).toBe('test-app')
    expect(json.version).toBe('1.0.0')
  })
})
