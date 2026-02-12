import type { Logger } from 'pino'
import type { AppContainer } from '../container/types.js'
import type { ITokenBlacklistWithCleanup } from '../adapters/token/index.js'
import type { IRateLimitStore } from '../adapters/cache/index.js'

/**
 * Graceful Shutdown Handler
 *
 * Manages cleanup of resources during application shutdown:
 * - Redis connections (token blacklist, rate limit store)
 * - Cleanup timers (in-memory stores)
 * - Any other registered cleanup functions
 *
 * Usage:
 *   const shutdown = createShutdownHandler(container, logger)
 *   shutdown.register()
 *
 * Handles signals: SIGTERM, SIGINT, SIGUSR2 (nodemon)
 */
export interface ShutdownHandler {
  /**
   * Register signal handlers for graceful shutdown
   */
  register(): void

  /**
   * Execute shutdown manually (for testing)
   */
  execute(): Promise<void>

  /**
   * Add a custom cleanup function
   */
  addCleanup(name: string, fn: () => void | Promise<void>): void
}

interface CleanupTask {
  name: string
  fn: () => void | Promise<void>
}

export function createShutdownHandler(
  container: AppContainer,
  logger: Logger,
): ShutdownHandler {
  const cleanupTasks: CleanupTask[] = []
  let isShuttingDown = false

  /**
   * Execute all cleanup tasks
   */
  async function executeShutdown(): Promise<void> {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal')
      return
    }
    isShuttingDown = true

    logger.info('Graceful shutdown initiated...')

    // Cleanup token blacklist
    try {
      const tokenBlacklist = container.resolve('tokenBlacklist') as ITokenBlacklistWithCleanup
      if (typeof tokenBlacklist.destroy === 'function') {
        logger.debug('Cleaning up token blacklist...')
        await tokenBlacklist.destroy()
      }
    } catch (err) {
      logger.error({ err }, 'Failed to cleanup token blacklist')
    }

    // Cleanup rate limit store
    try {
      const rateLimitStore = container.resolve('rateLimitStore') as IRateLimitStore
      if (typeof rateLimitStore.stopCleanup === 'function') {
        logger.debug('Stopping rate limit store cleanup timer...')
        rateLimitStore.stopCleanup()
      }
    } catch (err) {
      logger.error({ err }, 'Failed to cleanup rate limit store')
    }

    // Execute custom cleanup tasks
    for (const task of cleanupTasks) {
      try {
        logger.debug({ task: task.name }, 'Executing cleanup task...')
        await task.fn()
      } catch (err) {
        logger.error({ err, task: task.name }, 'Cleanup task failed')
      }
    }

    logger.info('Graceful shutdown complete')
  }

  /**
   * Signal handler wrapper
   */
  function handleSignal(signal: string): void {
    logger.info({ signal }, 'Received shutdown signal')
    executeShutdown()
      .then(() => {
        process.exit(0)
      })
      .catch((err) => {
        logger.error({ err }, 'Shutdown failed')
        process.exit(1)
      })
  }

  return {
    register(): void {
      // SIGTERM: Kubernetes/Docker graceful shutdown
      process.on('SIGTERM', () => handleSignal('SIGTERM'))

      // SIGINT: Ctrl+C in terminal
      process.on('SIGINT', () => handleSignal('SIGINT'))

      // SIGUSR2: Nodemon restart
      process.on('SIGUSR2', () => handleSignal('SIGUSR2'))

      logger.debug('Shutdown handlers registered')
    },

    execute: executeShutdown,

    addCleanup(name: string, fn: () => void | Promise<void>): void {
      cleanupTasks.push({ name, fn })
    },
  }
}
