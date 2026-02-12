import { neon } from '@neondatabase/serverless'
import type { Logger } from 'pino'
import type { IPostgresAdapter, EnvConfig } from '../../container/types.js'
import type { ConnectionResult } from '../../domain/types/health.js'
import { BaseDatabaseAdapter } from './BaseDatabaseAdapter.js'

/**
 * PostgreSQL adapter using Neon serverless driver
 * DRY: BaseDatabaseAdapter を継承し共通ロジックを再利用
 */
export class PostgresAdapter extends BaseDatabaseAdapter implements IPostgresAdapter {
  constructor(env: EnvConfig, logger: Logger) {
    super(env, logger)
  }

  async testConnection(): Promise<ConnectionResult> {
    return this.executeConnectionTest('DATABASE_URL', 'PostgreSQL (Neon)', async () => {
      const sql = neon(this.env.DATABASE_URL!)
      await sql`SELECT 1 as connected`
    })
  }
}
