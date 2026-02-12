/**
 * AWS Page Routes
 *
 * GET /aws                                        - ダッシュボード
 * GET /aws/resources                              - リソース一覧
 * GET /aws/costs                                  - コスト分析
 * GET /aws/alerts/high-cost                       - 高コストアラート
 * GET /aws/eks                                    - EKS概要
 * GET /aws/eks/nodegroups/:cluster/:nodegroup/systemlog - EKSシステムログ
 * GET /aws/admin/info                             - 管理者情報
 */

import { Hono } from 'hono'
import type { AWSPageServices } from '../../controllers/aws/page.js'
import {
  createAWSDashboardController,
  createAWSResourcesController,
  createAWSCostsController,
  createAWSAlertsController,
  createAWSEksOverviewController,
  createAWSEksSystemlogController,
  createAWSAdminInfoController,
} from '../../controllers/aws/page.js'

export function createAWSPageRoutes(services: AWSPageServices) {
  const app = new Hono()

  // Dashboard
  app.get('/', createAWSDashboardController(services))

  // Resources
  app.get('/resources', createAWSResourcesController(services))

  // Costs
  app.get('/costs', createAWSCostsController(services))

  // Alerts
  app.get('/alerts/high-cost', createAWSAlertsController(services))

  // EKS
  app.get('/eks', createAWSEksOverviewController(services))
  app.get('/eks/nodegroups/:cluster/:nodegroup/systemlog', createAWSEksSystemlogController(services))

  // Admin
  app.get('/admin/info', createAWSAdminInfoController())

  return app
}
