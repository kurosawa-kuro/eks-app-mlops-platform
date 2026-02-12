/**
 * AWS API Controllers
 * Handles AWS resource, cost, and EKS systemlog API requests
 */

import type { Context } from 'hono'
import type { ResourceService } from '../../../infra/aws/resourceService.js'
import type { CostService } from '../../../infra/aws/costService.js'
import type { EKSSystemlogService } from '../../../infra/aws/eksSystemlogService.js'
import type { Resource, ResourceType, ResourceCategory } from '../../../domain/entities/resource.js'
import { RESOURCE_TYPES, RESOURCE_CATEGORY_TYPES } from '../../../domain/entities/resource.js'
import { Errors } from '../../../shared/errors.js'

/** Convert Resource to JSON-serializable format */
function toResourceResponse(resource: Resource) {
  return {
    ...resource,
    timestamp: resource.timestamp.toISOString(),
    createdAt: resource.createdAt?.toISOString() ?? null,
    metadata: resource.metadata ?? {},
    tags: resource.tags ?? {},
  }
}

/** Resources List Controller */
export function createResourcesListController(resourceService: ResourceService) {
  return async (c: Context) => {
    const typeParam = c.req.query('type')
    const categoryParam = c.req.query('category')
    const forceRefresh = c.req.query('refresh') === 'true'

    let resources: Resource[]

    if (typeParam) {
      // Validate resource type
      if (!RESOURCE_TYPES.includes(typeParam as ResourceType)) {
        throw Errors.badRequest(`Invalid resource type: ${typeParam}`)
      }
      resources = await resourceService.getResources(typeParam as ResourceType, forceRefresh)
    } else if (categoryParam) {
      // Validate category
      if (!(categoryParam in RESOURCE_CATEGORY_TYPES)) {
        throw Errors.badRequest(`Invalid category: ${categoryParam}`)
      }
      resources = await resourceService.getResourcesByCategory(categoryParam as ResourceCategory, forceRefresh)
    } else {
      resources = await resourceService.getAllResources(forceRefresh)
    }

    return c.json({
      success: true,
      data: {
        resources: resources.map(toResourceResponse),
        count: resources.length,
      }
    })
  }
}

/** Resources Stats Controller */
export function createResourcesStatsController(resourceService: ResourceService) {
  return async (c: Context) => {
    const stats = await resourceService.getStats()
    const lastUpdated = resourceService.getLastUpdated()

    // Convert Map to object
    const lastUpdatedObj: Record<string, string | null> = {}
    for (const [key, value] of lastUpdated.entries()) {
      lastUpdatedObj[key] = value?.toISOString() ?? null
    }

    return c.json({
      success: true,
      data: {
        stats,
        lastUpdated: lastUpdatedObj,
      }
    })
  }
}

/** Resources Refresh Controller */
export function createResourcesRefreshController(resourceService: ResourceService) {
  return async (c: Context) => {
    await resourceService.refreshAll()
    return c.json({
      success: true,
      message: 'Cache invalidated. Resources will be fetched fresh on next request.',
    })
  }
}

/** Costs List Controller */
export function createCostsListController(costService: CostService) {
  return async (c: Context) => {
    const forceRefresh = c.req.query('refresh') === 'true'
    const summary = await costService.getCostSummary(forceRefresh)
    const lastUpdated = costService.getLastUpdated()

    return c.json({
      success: true,
      data: {
        summary: {
          ...summary,
          costs: summary.costs,
        },
        lastUpdated: lastUpdated?.toISOString() ?? null,
      }
    })
  }
}

/** EKS Nodegroup Systemlog Controller */
export function createEksSystemlogController(eksSystemlogService: EKSSystemlogService) {
  return async (c: Context) => {
    const cluster = c.req.param('cluster')
    const nodegroup = c.req.param('nodegroup')

    if (!cluster || !nodegroup) {
      throw Errors.badRequest('cluster and nodegroup parameters are required')
    }

    const info = await eksSystemlogService.getNodegroupInstancesWithKubeletStatus(cluster, nodegroup)

    if (!info) {
      throw Errors.notFound(`Nodegroup ${nodegroup} not found in cluster ${cluster}`)
    }

    return c.json({
      success: true,
      data: {
        clusterName: info.clusterName,
        nodegroupName: info.nodegroupName,
        instances: info.instances.map(instance => ({
          ...instance,
          launchTime: instance.launchTime?.toISOString() ?? null,
        })),
      }
    })
  }
}

/** EKS Instance Systemlog Controller */
export function createEksInstanceSystemlogController(eksSystemlogService: EKSSystemlogService) {
  return async (c: Context) => {
    const instanceId = c.req.param('instanceId')

    if (!instanceId) {
      throw Errors.badRequest('instanceId parameter is required')
    }

    const consoleOutput = await eksSystemlogService.getInstanceSystemlog(instanceId)

    return c.json({
      success: true,
      data: {
        instanceId,
        consoleOutput: consoleOutput?.output ?? null,
        timestamp: consoleOutput?.timestamp?.toISOString() ?? null,
      }
    })
  }
}
