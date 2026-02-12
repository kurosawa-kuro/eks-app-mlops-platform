import { serve, type ServerType } from '@hono/node-server'
import { appConfig } from './env/index.js'
import { createAppContainer } from './di/container.js'
import { createApp } from './app.js'
import { logger } from './shared/logger.js'

async function main() {
  const container = await createAppContainer()
  const app = createApp(container)

  const server: ServerType = serve({
    fetch: app.fetch,
    port: appConfig.port
  }, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    server.close()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

// Start server directly (tsx/ts-node doesn't work with import.meta.url entry detection)
main().catch((err) => {
  logger.error('Failed to start server:', err)
  process.exit(1)
})
