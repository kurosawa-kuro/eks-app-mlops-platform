import { app } from './app.js'
import { startServer } from './server.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { container } from './container/index.js'

logger.info(
  {
    env: env.NODE_ENV,
    port: env.PORT,
    hasDbUrl: !!env.DATABASE_URL,
  },
  'Starting application',
)

// Startup readiness check: verify DB connection and required tables exist
async function checkDatabaseReady(): Promise<void> {
  const healthService = container.resolve('healthService')
  const result = await healthService.testPostgres()
  if (!result.success) {
    throw new Error(`Database connection failed: ${result.message}`)
  }

  // Verify User table exists by running a count query
  const userRepository = container.resolve('userRepository')
  await userRepository.findByEmail('__startup_check__')
}

checkDatabaseReady()
  .then(() => {
    logger.info('Database readiness check passed')
    startServer(app, env.PORT)
  })
  .catch((err) => {
    logger.fatal({ err }, 'Database readiness check failed — run "npx prisma db push && npm run db:seed"')
    process.exit(1)
  })
