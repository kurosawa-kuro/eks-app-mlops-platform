import { Hono } from 'hono'
import { container } from '../../container/index.js'
import { requireRole, type AuthPayload } from '../../middleware/guard/index.js'

type AuditEnv = {
  Variables: {
    user?: AuthPayload
  }
}

const adminAudit = new Hono<AuditEnv>()

// =============================================================================
// Audit API Routes (Admin only) - JSON API for Next.js frontend
// =============================================================================

/**
 * GET /api/audit - Get audit logs with optional filtering
 * Admin only - requires login and admin role
 * Query params: userId, action, dateFrom, dateTo
 */
adminAudit.get('/', requireRole('admin'), async (c) => {
  const shopAuditService = container.resolve('shopAuditService')

  // Parse filter from query params
  const userId = c.req.query('userId') || undefined
  const action = c.req.query('action') || undefined
  const dateFrom = c.req.query('dateFrom') || undefined
  const dateTo = c.req.query('dateTo') || undefined

  const filter = { userId, action, dateFrom, dateTo }
  const hasFilter = !!(userId || action || dateFrom || dateTo)

  // Fetch logs (filtered or all)
  const logs = hasFilter
    ? await shopAuditService.findWithFilter(filter)
    : await shopAuditService.findAll()

  return c.json({
    success: true,
    data: logs,
  })
})

/**
 * GET /api/audit/actions - Get distinct actions for filter dropdown
 * Admin only
 */
adminAudit.get('/actions', requireRole('admin'), async (c) => {
  const shopAuditService = container.resolve('shopAuditService')
  const actions = await shopAuditService.getDistinctActions()

  return c.json({
    success: true,
    data: actions,
  })
})

export { adminAudit }
