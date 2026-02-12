/**
 * Test Container
 * --------------------------------
 * テスト用のDIコンテナを作成
 */
import { createContainer, asValue, InjectionMode } from 'awilix'
import type { AwilixContainer } from 'awilix'
import type { Cradle } from '../../src/di/container.js'
import type { CacheService } from '../../src/infra/cache/memoryCache.js'
import type { ResourceService } from '../../src/infra/aws/resourceService.js'
import type { CostService } from '../../src/infra/aws/costService.js'
import type { EKSSystemlogService } from '../../src/infra/aws/eksSystemlogService.js'
import {
  createMockCacheService,
  createMockResourceService,
  createMockCostService,
  createMockEksSystemlogService
} from './mocks.js'

export interface TestContainerOptions {
  // AWS Services
  cacheService?: CacheService
  resourceService?: ResourceService
  costService?: CostService
  eksSystemlogService?: EKSSystemlogService
}

/**
 * テスト用DIコンテナを作成
 * デフォルトでmocks.tsのFactory関数で生成したモックを使用
 */
export function createTestContainer(options: TestContainerOptions = {}): AwilixContainer<Cradle> {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  container.register({
    // AWS Services
    cacheService: asValue(options.cacheService ?? createMockCacheService()),
    resourceService: asValue(options.resourceService ?? createMockResourceService()),
    costService: asValue(options.costService ?? createMockCostService()),
    eksSystemlogService: asValue(options.eksSystemlogService ?? createMockEksSystemlogService()),

    // K8s Service
    k8sService: asValue(null),
  })

  return container
}

// Re-export factories for convenience
export {
  createMockCacheService,
  createMockResourceService,
  createMockCostService,
  createMockEksSystemlogService
} from './mocks.js'
