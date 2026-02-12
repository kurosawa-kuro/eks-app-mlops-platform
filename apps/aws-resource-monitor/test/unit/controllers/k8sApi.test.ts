import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  createStatusController,
  createNamespacesController,
} from '../../../src/presentation/controllers/k8s/api.js'

const now = new Date('2025-01-15T00:00:00Z')

const mockK8sService = {
  getStatus: vi.fn().mockResolvedValue({
    status: 'OK',
    namespaces: [
      {
        namespace: 'app',
        pods: [{ name: 'backend-abc', phase: 'Running', rawPhase: 'Running' }],
        allRunning: true,
      },
    ],
    karpenter: { running: 2, total: 2 },
    gpuNodes: null,
    llm: null,
    lastUpdated: now,
  }),
  getMonitoredNamespaces: vi.fn().mockReturnValue(['database', 'app', 'monitoring']),
}

describe('K8s API Controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createStatusController', () => {
    it('returns status with success and data', async () => {
      const app = new Hono()
      app.get('/test', createStatusController(mockK8sService as any))

      const res = await app.request('/test')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('OK')
      expect(json.data.namespaces).toHaveLength(1)
      expect(json.data.namespaces[0].namespace).toBe('app')
      expect(json.data.namespaces[0].allRunning).toBe(true)
      expect(json.data.namespaces[0].pods).toHaveLength(1)
      expect(json.data.namespaces[0].pods[0].name).toBe('backend-abc')
      expect(json.data.namespaces[0].pods[0].phase).toBe('Running')
      expect(json.data.karpenter).toEqual({ running: 2, total: 2 })
      expect(json.data.gpuNodes).toBeNull()
      expect(json.data.llm).toBeNull()
      expect(json.data.lastUpdated).toBe('2025-01-15T00:00:00.000Z')
      expect(mockK8sService.getStatus).toHaveBeenCalledWith(false)
    })

    it('passes refresh=true when query parameter is set', async () => {
      const app = new Hono()
      app.get('/test', createStatusController(mockK8sService as any))

      const res = await app.request('/test?refresh=true')
      expect(res.status).toBe(200)
      expect(mockK8sService.getStatus).toHaveBeenCalledWith(true)
    })
  })

  describe('createNamespacesController', () => {
    it('returns namespaces list with count', async () => {
      const app = new Hono()
      app.get('/test', createNamespacesController(mockK8sService as any))

      const res = await app.request('/test')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.namespaces).toEqual(['database', 'app', 'monitoring'])
      expect(json.data.count).toBe(3)
      expect(mockK8sService.getMonitoredNamespaces).toHaveBeenCalledOnce()
    })
  })
})
