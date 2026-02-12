import type { Logger } from 'pino'
import type { EnvConfig } from '../../container/types.js'
import type { ConnectionResult } from '../../domain/types/health.js'

/**
 * Base database adapter with common connection testing logic
 *
 * DRY: PostgresAdapter/MongoAdapter の重複パターンを基底クラスに集約
 * 理由: 接続テストのエラーハンドリングとログ出力パターンが同一
 */
export abstract class BaseDatabaseAdapter {
  constructor(
    protected readonly env: EnvConfig,
    protected readonly logger: Logger,
  ) {}

  /**
   * Execute connection test with standardized error handling and logging
   * @param envKey - Environment variable key to check
   * @param dbName - Database name for logging
   * @param testFn - Actual connection test function
   */
  protected async executeConnectionTest(
    envKey: keyof EnvConfig,
    dbName: string,
    testFn: () => Promise<void>,
  ): Promise<ConnectionResult> {
    const connectionString = this.env[envKey]
    if (!connectionString) {
      return { success: false, message: `${envKey} is not configured` }
    }

    try {
      await testFn()
      this.logger.info(`${dbName} connection successful`)
      return { success: true, message: `Connected to ${dbName}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const cause = error instanceof Error && error.cause ? error.cause : undefined
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(
        {
          error,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: message,
          errorCause: cause,
          errorStack: stack,
        },
        `${dbName} connection failed`,
      )
      return { success: false, message }
    }
  }
}
