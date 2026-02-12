/**
 * Admin Routes - API routes only
 *
 * Note: Page routes (pages.ts) have been removed.
 * Frontend is now handled by Next.js (app-frontend).
 *
 * Includes:
 * - Audit log API
 * - User registration API (admin-only)
 */

export { adminAudit } from './audit.js'
export { adminRegister } from './register.js'
