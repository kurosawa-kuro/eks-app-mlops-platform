import { logger } from '../shared/logger.js'
import { loadConfig } from './loader.js'

export type { AppConfig } from './schema.js'
export { appConfigSchema } from './schema.js'

/**
 * アプリケーション設定
 * 優先順位:
 *   1. ConfigMap: env/config.json（最優先）
 *   2. 環境変数 (Doppler / K8s Secret envFrom)
 */
export const appConfig = loadConfig()

logger.info({ env: appConfig.appEnv, mode: appConfig.appMode }, 'Config loaded')
