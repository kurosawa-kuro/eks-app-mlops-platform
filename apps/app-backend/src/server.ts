import { serve, type ServerType } from '@hono/node-server'
import { logger } from './config/logger.js'
import { container } from './container/index.js'
import type { ITokenBlacklistWithCleanup } from './adapters/token/index.js'
import type { IRateLimitStore } from './adapters/cache/index.js'

let server: ServerType | null = null

export const startServer = (app: { fetch: (req: Request) => Response | Promise<Response> }, port: number) => {
  server = serve({
    fetch: app.fetch,
    port,
  })

  logger.info({ port }, 'Server started')

  // Graceful Shutdown with resource cleanup
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received')

    // Cleanup DI container resources
    try {
      // Cleanup token blacklist (Redis connection or timers)
      const tokenBlacklist = container.resolve('tokenBlacklist') as ITokenBlacklistWithCleanup
      if (typeof tokenBlacklist.destroy === 'function') {
        logger.debug('Cleaning up token blacklist...')
        await tokenBlacklist.destroy()
      }

      // Stop rate limit store cleanup timer
      const rateLimitStore = container.resolve('rateLimitStore') as IRateLimitStore
      if (typeof rateLimitStore.stopCleanup === 'function') {
        logger.debug('Stopping rate limit store cleanup...')
        rateLimitStore.stopCleanup()
      }
    } catch (err) {
      logger.error({ err }, 'Error during resource cleanup')
    }

    if (!server) {
      process.exit(0)
    }

    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error during shutdown')
        process.exit(1)
      }
      logger.info('Server closed gracefully')
      process.exit(0)
    })

    // 強制終了タイマー（10秒）
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}
