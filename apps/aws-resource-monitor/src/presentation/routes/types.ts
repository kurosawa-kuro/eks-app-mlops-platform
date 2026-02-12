/**
 * Route Context
 * --------------------------------
 * 各Routeに渡すコンテキスト
 */
import type { AwilixContainer } from 'awilix'
import type { AppConfig } from '../../env/index.js'
import type { Cradle } from '../../di/container.js'

export interface RouteContext {
  // DI Container（依存解決はここから）
  container: AwilixContainer<Cradle>

  // Config
  appConfig: AppConfig
}
