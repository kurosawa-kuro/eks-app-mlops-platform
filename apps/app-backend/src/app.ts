import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'

// Initialize DI container (must be imported before routes)
import './container/index.js'

// =============================================================================
// Route Imports (organized by responsibility)
// =============================================================================

// Shop Routes - API only (pages moved to Next.js frontend)
import { shopRoutes, authRoutes, shopApi } from './routes/shop/index.js'

// Admin Routes - API only (pages moved to Next.js frontend)
import { adminAudit, adminRegister } from './routes/admin/index.js'

// DevTool Routes - Developer and infrastructure
import {
  devtoolPages,
  devtoolHealth,
  devtoolMetrics,
  devtoolDevAuth,
  devtoolInternalAnalytics,
  devtoolInternalLlm,
} from './routes/devtool/index.js'

import { env } from './config/env.js'

// Middleware (organized by category)
import {
  errorHandler,
  requestIdMiddleware,
  metricsMiddleware,
  accessLogMiddleware,
} from './middleware/observability/index.js'
import { apiRateLimiter } from './middleware/guard/index.js'

import type { AuthPayload } from './domain/types/auth.js'

type AppEnv = {
  Variables: {
    user: AuthPayload
    requestId: string
  }
}

const app = new Hono<AppEnv>()

// =============================================================================
// Observability Middleware Stack
// =============================================================================

// Global error handler (catches all unhandled errors)
app.onError(errorHandler)

// Request ID middleware (MUST be first for correlation)
app.use('*', requestIdMiddleware)

// Metrics collection (Prometheus)
app.use('*', metricsMiddleware)

// Access logging (Console/Firehose based on LOG_MODE)
app.use('*', accessLogMiddleware)

// =============================================================================
// Guard Middleware
// =============================================================================

// CORS configuration
app.use('*', cors({
  origin: env.ALLOWED_ORIGIN || (env.NODE_ENV === 'production' ? [] : ['http://localhost:8000', 'http://localhost:8001', 'http://localhost:3000']),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))

// CSRF protection for state-changing requests
// Disabled in test and development environments for convenience
if (env.NODE_ENV === 'production') {
  app.use('*', csrf({
    origin: env.ALLOWED_ORIGIN || undefined,
  }))
}

// API rate limiting
app.use('/api/*', apiRateLimiter)

// =============================================================================
// Shop API Routes (Pages moved to Next.js frontend)
// =============================================================================

app.route('/shop', shopRoutes)  // Legacy SSR routes (for backward compatibility)
app.route('/api/auth', authRoutes)
app.route('/api/shop', shopApi)  // JSON API for Next.js frontend

// =============================================================================
// Admin API Routes (Pages moved to Next.js frontend)
// =============================================================================

app.route('/api/audit', adminAudit)
app.route('/api/register', adminRegister)

// =============================================================================
// DevTool Routes (Developer / Infrastructure)
// =============================================================================

app.route('/devtool', devtoolPages)
app.route('/health', devtoolHealth)
app.route('/metrics', devtoolMetrics)

// Development-only auth routes (test login bypass)
if (env.NODE_ENV !== 'production') {
  app.route('/api/dev', devtoolDevAuth)
}

// Internal analytics routes (staging only)
if (env.ENABLE_ANALYTICS_API) {
  app.route('/internal/analytics', devtoolInternalAnalytics)
}

// Internal LLM proxy routes (staging/prod)
if (env.ENABLE_LLM_API) {
  app.route('/internal/llm', devtoolInternalLlm)
}

export { app }
