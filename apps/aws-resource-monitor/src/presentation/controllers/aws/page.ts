/**
 * AWS Page Controllers
 * Handles AWS resource monitoring page rendering
 *
 * old-backendから完全移植
 */

import type { Context } from 'hono'
import type { ResourceService } from '../../../infra/aws/resourceService.js'
import type { CostService } from '../../../infra/aws/costService.js'
import type { EKSSystemlogService, NodegroupInstanceInfo } from '../../../infra/aws/eksSystemlogService.js'
import type { Resource, ResourceType, ResourceCategory } from '../../../domain/entities/resource.js'
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_CATEGORY_LABELS,
  RESOURCE_CATEGORY_TYPES,
  isHighCostAlertTarget,
  getHighCostLevel,
  HIGH_COST_CRITICAL_TYPES,
  HIGH_COST_WARNING_TYPES,
  ALL_HIGH_COST_TYPES
} from '../../../domain/entities/resource.js'
import { render } from '../../helpers/render.js'
import { formatLastUpdated } from '../../helpers/awsFormatters.js'

// ============================================================================
// Service Dependencies Interface
// ============================================================================

export interface AWSPageServices {
  resourceService: ResourceService
  costService: CostService
  eksSystemlogService: EKSSystemlogService
}

// ============================================================================
// Dashboard Page
// ============================================================================

export function createAWSDashboardController(services: AWSPageServices) {
  const { resourceService, costService } = services

  return async (c: Context) => {
    const allResources = await resourceService.getAllResources()
    const stats = await resourceService.getStats()
    const costSummary = await costService.getCostSummary()
    const lastUpdated = formatLastUpdated(resourceService.getLastUpdated())

    // Group resources by type
    const resourcesByType: Record<string, typeof allResources> = {}
    for (const type of RESOURCE_TYPES) {
      resourcesByType[type] = allResources.filter(r => r.type === type)
    }

    // Count high cost alert resources
    const highCostAlertCount = allResources.filter(r =>
      isHighCostAlertTarget(r.type, r.state)
    ).length

    // Category resources mapping
    const categoryResources: Record<ResourceCategory, ResourceType[]> = {
      'eks-related': RESOURCE_CATEGORY_TYPES['eks-related'],
      'compute': ['ec2', 'lambda', 'autoscalinggroup'],
      'storage': ['s3', 'ebs', 'ecr'],
      'database': ['rds', 'elasticache'],
      'networking': ['vpc', 'subnet', 'igw', 'routetable', 'natgateway', 'vpcendpoint', 'elb', 'targetgroup', 'eip'],
      'security': ['securitygroup', 'keypair', 'iamrole', 'iampolicy', 'kmskey'],
      'dns-certificates': ['route53zone', 'acmcertificate'],
      'logging-messaging': ['cloudwatchlogs', 'sqsqueue', 'kinesisfirehose']
    }

    return render(c, 'aws/dashboard', {
      layout: 'aws-main',
      title: 'AWS Dashboard',
      pageTitle: 'AWS Resource Monitor',
      activePage: 'dashboard',
      resourcesByType,
      resourceTypes: RESOURCE_TYPES,
      resourceTypeLabels: RESOURCE_TYPE_LABELS,
      resourceCategories: RESOURCE_CATEGORY_LABELS,
      categoryResources,
      highCostAlertCount,
      stats,
      costSummary,
      lastUpdated
    })
  }
}

// ============================================================================
// Resources Page
// ============================================================================

export function createAWSResourcesController(services: AWSPageServices) {
  const { resourceService } = services

  return async (c: Context) => {
    const typeParam = c.req.query('type')
    const categoryParam = c.req.query('category')
    const projectParam = c.req.query('project')
    const searchParam = c.req.query('search')
    const sortParam = c.req.query('sort') || 'name'
    const orderParam = c.req.query('order') || 'asc'
    const pageParam = parseInt(c.req.query('page') || '1', 10)
    const limitParam = parseInt(c.req.query('limit') || '50', 10)

    const allResources = await resourceService.getAllResources()

    // Extract unique project names for filter dropdown
    const projectNames = [...new Set(
      allResources
        .map(r => r.tags?.Project)
        .filter((p): p is string => !!p)
    )].sort()

    let resources = allResources

    // Filter by type
    if (typeParam && RESOURCE_TYPES.includes(typeParam as ResourceType)) {
      resources = resources.filter(r => r.type === typeParam)
    }

    // Filter by category
    if (categoryParam && categoryParam in RESOURCE_CATEGORY_TYPES) {
      const categoryTypes = RESOURCE_CATEGORY_TYPES[categoryParam as ResourceCategory]
      resources = resources.filter(r => categoryTypes.includes(r.type))
    }

    // Filter by project
    if (projectParam) {
      resources = resources.filter(r => r.tags?.Project === projectParam)
    }

    // Search
    if (searchParam) {
      const search = searchParam.toLowerCase()
      resources = resources.filter(r =>
        (r.name?.toLowerCase().includes(search)) ||
        r.resourceId.toLowerCase().includes(search)
      )
    }

    // Sort
    resources.sort((a, b) => {
      let aVal: string | undefined
      let bVal: string | undefined

      switch (sortParam) {
        case 'name':
          aVal = a.name || a.resourceId
          bVal = b.name || b.resourceId
          break
        case 'project':
          aVal = a.tags?.Project || ''
          bVal = b.tags?.Project || ''
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'state':
          aVal = a.state || ''
          bVal = b.state || ''
          break
        case 'resourceId':
          aVal = a.resourceId
          bVal = b.resourceId
          break
        case 'createdAt':
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return orderParam === 'desc' ? bDate - aDate : aDate - bDate
        default:
          aVal = a.name || a.resourceId
          bVal = b.name || b.resourceId
      }

      const comparison = aVal.localeCompare(bVal)
      return orderParam === 'desc' ? -comparison : comparison
    })

    // Pagination
    const totalItems = resources.length
    const totalPages = Math.ceil(totalItems / limitParam)
    const startIndex = (pageParam - 1) * limitParam
    const paginatedResources = resources.slice(startIndex, startIndex + limitParam)

    // Get last updated time
    const lastUpdated = formatLastUpdated(resourceService.getLastUpdated())

    return render(c, 'aws/resources', {
      layout: 'aws-main',
      title: 'Resources',
      pageTitle: 'All Resources',
      activePage: 'resources',
      resources: paginatedResources,
      totalItems,
      totalPages,
      currentPage: pageParam,
      limit: limitParam,
      resourceTypes: RESOURCE_TYPES,
      resourceTypeLabels: RESOURCE_TYPE_LABELS,
      resourceCategories: RESOURCE_CATEGORY_LABELS,
      categoryTypes: RESOURCE_CATEGORY_TYPES,
      projectNames,
      filters: {
        type: typeParam || '',
        category: categoryParam || '',
        project: projectParam || '',
        search: searchParam || '',
        sort: sortParam,
        order: orderParam
      },
      lastUpdated
    })
  }
}

// ============================================================================
// Costs Page
// ============================================================================

export function createAWSCostsController(services: AWSPageServices) {
  const { costService } = services

  return async (c: Context) => {
    const costs = await costService.getCosts()
    const summary = await costService.getCostSummary()

    // Sort by amount descending
    const sortedCosts = [...costs].sort((a, b) => b.amount - a.amount)

    return render(c, 'aws/costs', {
      layout: 'aws-main',
      title: 'Costs',
      pageTitle: 'Cost Explorer',
      activePage: 'costs',
      costs: sortedCosts,
      summary
    })
  }
}

// ============================================================================
// High Cost Alerts Page
// ============================================================================

export function createAWSAlertsController(services: AWSPageServices) {
  const { resourceService } = services

  return async (c: Context) => {
    const allResources = await resourceService.getAllResources()

    // 高コストリソースをフィルタリング
    const highCostResources = allResources.filter(r =>
      isHighCostAlertTarget(r.type, r.state)
    )

    // タイプ別にグループ化
    const resourcesByType: Record<string, typeof allResources> = {}
    for (const type of ALL_HIGH_COST_TYPES) {
      resourcesByType[type] = highCostResources.filter(r => r.type === type)
    }

    // 危険度別にカウント
    const criticalCount = highCostResources.filter(r =>
      getHighCostLevel(r.type) === 'critical'
    ).length
    const warningCount = highCostResources.filter(r =>
      getHighCostLevel(r.type) === 'warning'
    ).length

    // lastUpdated取得
    const lastUpdated = formatLastUpdated(resourceService.getLastUpdated())

    return render(c, 'aws/alerts-high-cost', {
      layout: 'aws-main',
      title: 'High Cost Alerts',
      pageTitle: 'High Cost Risk Resources',
      activePage: 'alerts',
      highCostResources,
      resourcesByType,
      highCostCriticalTypes: HIGH_COST_CRITICAL_TYPES,
      highCostWarningTypes: HIGH_COST_WARNING_TYPES,
      allHighCostTypes: ALL_HIGH_COST_TYPES,
      resourceTypeLabels: RESOURCE_TYPE_LABELS,
      lastUpdated,
      totalCount: highCostResources.length,
      criticalCount,
      warningCount
    })
  }
}

// ============================================================================
// EKS Overview Page
// ============================================================================

interface NodegroupWithInstances extends Resource {
  instances?: NodegroupInstanceInfo[]
}

interface ClusterInfo {
  cluster: Resource
  nodegroups: NodegroupWithInstances[]
  addons: Resource[]
  autoScalingGroups: Resource[]
}

export function createAWSEksOverviewController(services: AWSPageServices) {
  const { resourceService, eksSystemlogService } = services

  return async (c: Context) => {
    // EKSクラスタを取得
    const eksClusters = await resourceService.getResources('eks')

    // Nodegroupを取得
    const nodegroups = await resourceService.getResources('nodegroup')

    // EKS Addonsを取得
    const addons = await resourceService.getResources('eksaddon')

    // Auto Scaling Groupsを取得
    const autoScalingGroups = await resourceService.getResources('autoscalinggroup')

    // クラスタごとにNodegroupとAddonsをグループ化
    const clusterInfos: ClusterInfo[] = await Promise.all(
      eksClusters.map(async cluster => {
        const clusterName = cluster.name || ''
        const clusterNodegroups = nodegroups.filter(
          ng => ng.metadata?.clusterName === clusterName
        )

        // 各NodegroupのEC2インスタンス情報（kubelet状態付き）を取得
        const nodegroupsWithInstances: NodegroupWithInstances[] = await Promise.all(
          clusterNodegroups.map(async ng => {
            const instanceInfo = await eksSystemlogService.getNodegroupInstancesWithKubeletStatus(
              clusterName,
              ng.name || ''
            )
            return {
              ...ng,
              instances: instanceInfo?.instances ?? []
            }
          })
        )

        // クラスタに関連するASGをフィルタリング（eks:cluster-nameタグまたはNodegroup名で判定）
        const clusterASGs = autoScalingGroups.filter(asg => {
          // タグでクラスタ名をチェック
          const tags = asg.metadata?.tags as Record<string, string> | undefined
          if (tags) {
            // eks:cluster-name タグをチェック
            if (tags['eks:cluster-name'] === clusterName) return true
            // kubernetes.io/cluster/<cluster-name> タグをチェック
            if (tags[`kubernetes.io/cluster/${clusterName}`]) return true
          }
          // ASG名にクラスタ名が含まれているかチェック
          if (asg.name?.includes(clusterName)) return true
          return false
        })

        return {
          cluster,
          nodegroups: nodegroupsWithInstances,
          addons: addons.filter(
            addon => addon.metadata?.clusterName === clusterName
          ),
          autoScalingGroups: clusterASGs
        }
      })
    )

    // lastUpdated取得
    const lastUpdated = formatLastUpdated(resourceService.getLastUpdated())

    return render(c, 'aws/eks-overview', {
      layout: 'aws-main',
      title: 'EKS Overview',
      pageTitle: 'EKS Clusters Overview',
      activePage: 'eks',
      clusterInfos,
      totalClusters: eksClusters.length,
      totalNodegroups: nodegroups.length,
      totalAddons: addons.length,
      totalASGs: autoScalingGroups.length,
      lastUpdated
    })
  }
}

// ============================================================================
// EKS Systemlog Page
// ============================================================================

export function createAWSEksSystemlogController(services: AWSPageServices) {
  const { eksSystemlogService } = services

  return async (c: Context) => {
    const cluster = c.req.param('cluster')
    const nodegroup = c.req.param('nodegroup')

    // Nodegroupのインスタンス情報を取得
    const nodegroupInfo = await eksSystemlogService.getNodegroupInstances(cluster, nodegroup)

    return render(c, 'aws/eks-systemlog', {
      layout: 'aws-main',
      title: `EKS Systemlog - ${nodegroup}`,
      activePage: 'eks',
      clusterName: cluster,
      nodegroupName: nodegroup,
      nodegroupInfo
    })
  }
}

// ============================================================================
// Admin Info Page
// ============================================================================

export function createAWSAdminInfoController() {
  return async (c: Context) => {
    return render(c, 'aws/admin-info', {
      layout: 'aws-main',
      title: 'Admin Info',
      activePage: 'admin',
    })
  }
}
