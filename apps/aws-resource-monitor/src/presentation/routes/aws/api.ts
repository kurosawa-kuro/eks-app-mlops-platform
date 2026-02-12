/**
 * AWS API Routes
 *
 * GET  /api/aws/resources         - リソース一覧
 * GET  /api/aws/resources/stats   - リソース統計
 * POST /api/aws/resources/refresh - キャッシュ更新
 * GET  /api/aws/costs             - コスト一覧
 * GET  /api/aws/eks/nodegroups/:cluster/:nodegroup/instances - EKSノードグループインスタンス
 * GET  /api/aws/eks/instances/:instanceId/systemlog - インスタンスシステムログ
 */

import { Hono } from 'hono'
import type { ResourceService } from '../../../infra/aws/resourceService.js'
import type { CostService } from '../../../infra/aws/costService.js'
import type { EKSSystemlogService } from '../../../infra/aws/eksSystemlogService.js'
import {
  createResourcesListController,
  createResourcesStatsController,
  createResourcesRefreshController,
  createCostsListController,
  createEksSystemlogController,
  createEksInstanceSystemlogController,
} from '../../controllers/aws/api.js'

interface AWSApiDeps {
  resourceService: ResourceService
  costService: CostService
  eksSystemlogService: EKSSystemlogService
}

export function createAWSApiRoutes(deps: AWSApiDeps) {
  const app = new Hono()
  const { resourceService, costService, eksSystemlogService } = deps

  // Resources
  app.get('/resources', createResourcesListController(resourceService))
  app.get('/resources/stats', createResourcesStatsController(resourceService))
  app.post('/resources/refresh', createResourcesRefreshController(resourceService))

  // Costs
  app.get('/costs', createCostsListController(costService))

  // EKS
  app.get('/eks/nodegroups/:cluster/:nodegroup/instances', createEksSystemlogController(eksSystemlogService))
  app.get('/eks/instances/:instanceId/systemlog', createEksInstanceSystemlogController(eksSystemlogService))

  return app
}
