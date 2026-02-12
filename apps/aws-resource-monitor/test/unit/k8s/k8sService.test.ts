import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createK8sMinimalService } from '../../../src/infra/k8s/k8sService.js'

const mockK8sAdapter = {
  listNodes: vi.fn().mockResolvedValue([]),
  listPods: vi.fn().mockResolvedValue([]),
  getPod: vi.fn().mockResolvedValue(null),
  listPodsByLabel: vi.fn().mockResolvedValue([]),
  listNamespaces: vi.fn().mockResolvedValue([]),
}

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  invalidate: vi.fn(),
  invalidateByPrefix: vi.fn(),
  invalidateAll: vi.fn(),
  getLastUpdated: vi.fn().mockReturnValue(null),
  has: vi.fn().mockReturnValue(false),
  keys: vi.fn().mockReturnValue([]),
}

const CACHE_TTL_MS = 30_000

function makePod(
  name: string,
  namespace: string,
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
) {
  return {
    name,
    namespace,
    uid: `uid-${name}`,
    labels: {},
    annotations: {},
    creationTimestamp: new Date(),
    spec: {},
    status: { phase },
  }
}

describe('createK8sMinimalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCache.get.mockReturnValue(null)
  })

  describe('getMonitoredNamespaces', () => {
    it('returns custom namespaces when provided', () => {
      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['custom-ns-a', 'custom-ns-b']
      )

      expect(service.getMonitoredNamespaces()).toEqual(['custom-ns-a', 'custom-ns-b'])
    })

    it('returns default namespaces when not provided', () => {
      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS
      )

      expect(service.getMonitoredNamespaces()).toEqual([
        'database',
        'app',
        'monitoring',
        'karpenter',
        'llm',
      ])
    })
  })

  describe('getStatus', () => {
    it('returns status OK when all pods are running', async () => {
      mockK8sAdapter.listPods.mockImplementation((ns: string) => {
        if (ns === 'database') {
          return Promise.resolve([makePod('postgres-0', 'database', 'Running')])
        }
        if (ns === 'app') {
          return Promise.resolve([makePod('backend-abc', 'app', 'Running')])
        }
        return Promise.resolve([])
      })

      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['database', 'app']
      )

      const result = await service.getStatus()

      expect(result.status).toBe('OK')
      expect(result.namespaces).toHaveLength(2)

      const dbNs = result.namespaces.find((ns) => ns.namespace === 'database')!
      expect(dbNs.allRunning).toBe(true)
      expect(dbNs.pods).toEqual([
        { name: 'postgres-0', phase: 'Running', rawPhase: 'Running' },
      ])

      const appNs = result.namespaces.find((ns) => ns.namespace === 'app')!
      expect(appNs.allRunning).toBe(true)
      expect(appNs.pods).toEqual([
        { name: 'backend-abc', phase: 'Running', rawPhase: 'Running' },
      ])

      expect(result.lastUpdated).toBeInstanceOf(Date)
      expect(mockCache.set).toHaveBeenCalledTimes(1)
    })

    it('returns status NG when some pods are not running', async () => {
      mockK8sAdapter.listPods.mockImplementation((ns: string) => {
        if (ns === 'database') {
          return Promise.resolve([makePod('postgres-0', 'database', 'Pending')])
        }
        if (ns === 'app') {
          return Promise.resolve([makePod('backend-abc', 'app', 'Running')])
        }
        return Promise.resolve([])
      })

      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['database', 'app']
      )

      const result = await service.getStatus()

      expect(result.status).toBe('NG')

      const dbNs = result.namespaces.find((ns) => ns.namespace === 'database')!
      expect(dbNs.allRunning).toBe(false)
      expect(dbNs.pods[0]).toEqual({
        name: 'postgres-0',
        phase: 'NotRunning',
        rawPhase: 'Pending',
      })

      const appNs = result.namespaces.find((ns) => ns.namespace === 'app')!
      expect(appNs.allRunning).toBe(true)
    })

    it('returns cached result when cache hit', async () => {
      const cachedStatus = {
        status: 'OK' as const,
        namespaces: [],
        karpenter: null,
        gpuNodes: null,
        llm: null,
        lastUpdated: new Date('2025-01-01T00:00:00Z'),
      }
      mockCache.get.mockReturnValue(cachedStatus)

      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['database', 'app']
      )

      const result = await service.getStatus()

      expect(result).toBe(cachedStatus)
      expect(mockK8sAdapter.listPods).not.toHaveBeenCalled()
      expect(mockK8sAdapter.listNodes).not.toHaveBeenCalled()
    })

    it('extracts karpenter status and filters it out of namespaces', async () => {
      mockK8sAdapter.listPods.mockImplementation((ns: string) => {
        if (ns === 'karpenter') {
          return Promise.resolve([
            makePod('karpenter-controller-0', 'karpenter', 'Running'),
            makePod('karpenter-webhook-0', 'karpenter', 'Running'),
          ])
        }
        if (ns === 'app') {
          return Promise.resolve([makePod('backend-abc', 'app', 'Running')])
        }
        return Promise.resolve([])
      })

      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['karpenter', 'app']
      )

      const result = await service.getStatus()

      expect(result.karpenter).toEqual({ running: 2, total: 2 })

      const karpenterInDisplay = result.namespaces.find((ns) => ns.namespace === 'karpenter')
      expect(karpenterInDisplay).toBeUndefined()

      const appNs = result.namespaces.find((ns) => ns.namespace === 'app')
      expect(appNs).toBeDefined()
      expect(appNs!.allRunning).toBe(true)
    })

    it('extracts llm status and filters it out of namespaces', async () => {
      mockK8sAdapter.listPods.mockImplementation((ns: string) => {
        if (ns === 'llm') {
          return Promise.resolve([
            makePod('embedding-server', 'llm', 'Running'),
            makePod('inference-server', 'llm', 'Running'),
            makePod('other-worker', 'llm', 'Running'),
          ])
        }
        if (ns === 'app') {
          return Promise.resolve([makePod('backend-abc', 'app', 'Running')])
        }
        return Promise.resolve([])
      })

      const service = createK8sMinimalService(
        mockK8sAdapter as any,
        mockCache as any,
        CACHE_TTL_MS,
        ['llm', 'app']
      )

      const result = await service.getStatus()

      expect(result.llm).not.toBeNull()
      expect(result.llm!.allRunning).toBe(true)
      expect(result.llm!.pods).toHaveLength(3)

      const embeddingPod = result.llm!.pods.find((p) => p.name === 'embedding-server')!
      expect(embeddingPod.type).toBe('embeddings')
      expect(embeddingPod.ready).toBe(true)

      const inferencePod = result.llm!.pods.find((p) => p.name === 'inference-server')!
      expect(inferencePod.type).toBe('inference')
      expect(inferencePod.ready).toBe(true)

      const otherPod = result.llm!.pods.find((p) => p.name === 'other-worker')!
      expect(otherPod.type).toBe('other')
      expect(otherPod.ready).toBe(true)

      const llmInDisplay = result.namespaces.find((ns) => ns.namespace === 'llm')
      expect(llmInDisplay).toBeUndefined()

      const appNs = result.namespaces.find((ns) => ns.namespace === 'app')
      expect(appNs).toBeDefined()
    })
  })
})
