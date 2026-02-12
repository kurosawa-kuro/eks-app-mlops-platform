/**
 * Common Mocks
 * --------------------------------
 * テスト用の共通モック定義
 */
import { vi } from 'vitest'
import type { AppConfig } from '../../src/env/index.js'
import type { CacheService } from '../../src/infra/cache/memoryCache.js'
import type { ResourceService } from '../../src/infra/aws/resourceService.js'
import type { CostService } from '../../src/infra/aws/costService.js'
import type { EKSSystemlogService } from '../../src/infra/aws/eksSystemlogService.js'

// ============================================
// Mock Factory Functions
// ============================================

/**
 * AppConfig のモックを作成
 */
export function createMockAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    appEnv: 'local',
    appMode: 'origin',
    projectName: 'test-app',
    port: 3000,
    logLevel: 'info',
    rateLimitPerMinute: 100,
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'ap-northeast-1',
    cacheTtlResources: 300000,
    cacheTtlCosts: 3600000,
    k8sNamespace: '',
    k8sMonitoredNamespaces: 'database,app,monitoring',
    k8sBastionInstanceId: '',
    k8sEksClusterName: '',
    prometheusUrl: 'http://prometheus:9090',
    lokiUrl: 'http://loki:3100',
    cacheTtlK8s: 60000,
    cacheTtlMetrics: 30000,
    alertEnabled: false,
    alertChannel: 'slack',
    alertSlackWebhookUrl: '',
    alertEmailTo: '',
    ...overrides
  } as AppConfig
}

// ============================================
// AWS Service Mock Factory Functions
// ============================================

/**
 * CacheService のモックを作成
 */
export function createMockCacheService(overrides: Partial<CacheService> = {}): CacheService {
  return {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
    invalidateByPrefix: vi.fn(),
    invalidateAll: vi.fn(),
    getLastUpdated: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    keys: vi.fn().mockReturnValue([]),
    ...overrides
  }
}

/**
 * ResourceService のモックを作成
 */
export function createMockResourceService(overrides: Partial<ResourceService> = {}): ResourceService {
  return {
    getResources: vi.fn().mockResolvedValue([]),
    getAllResources: vi.fn().mockResolvedValue([]),
    getResourcesByCategory: vi.fn().mockResolvedValue([]),
    getEksRelatedResources: vi.fn().mockResolvedValue([]),
    refreshAll: vi.fn().mockResolvedValue(undefined),
    getLastUpdated: vi.fn().mockReturnValue(new Map()),
    getStats: vi.fn().mockResolvedValue({ total: 0, byType: {} }),
    ...overrides
  }
}

/**
 * CostService のモックを作成
 */
export function createMockCostService(overrides: Partial<CostService> = {}): CostService {
  return {
    getCosts: vi.fn().mockResolvedValue([]),
    getCostSummary: vi.fn().mockResolvedValue({
      totalAmount: 0,
      unit: 'USD',
      periodStart: '2025-01-01',
      periodEnd: '2025-02-01',
      serviceCount: 0,
      costs: []
    }),
    refresh: vi.fn().mockResolvedValue(undefined),
    getLastUpdated: vi.fn().mockReturnValue(null),
    ...overrides
  }
}

/**
 * EKSSystemlogService のモックを作成
 */
export function createMockEksSystemlogService(overrides: Partial<EKSSystemlogService> = {}): EKSSystemlogService {
  return {
    getNodegroupInstances: vi.fn().mockResolvedValue(null),
    getInstanceSystemlog: vi.fn().mockResolvedValue(null),
    getNodegroupInstancesWithKubeletStatus: vi.fn().mockResolvedValue(null),
    parseKubeletStatus: vi.fn().mockReturnValue('unknown'),
    ...overrides
  }
}

// ============================================
// vi.mock Setup Helpers
// ============================================

/**
 * vi.mock用のrender.jsモック定義
 * 使用: vi.mock('../../../src/presentation/helpers/render.js', () => renderMock)
 */
export const renderMock = {
  render: vi.fn().mockResolvedValue(new Response('<html></html>'))
}

/**
 * vi.mock用のejs モック定義
 * 使用: vi.mock('ejs', () => ejsMock)
 */
export const ejsMock = {
  renderFile: vi.fn().mockResolvedValue('<html><body>Test</body></html>')
}
