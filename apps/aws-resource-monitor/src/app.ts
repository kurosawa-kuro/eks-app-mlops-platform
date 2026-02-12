/**
 * App Factory
 * --------------------------------
 * Honoアプリケーションを作成
 *
 * 使用方法:
 * - 本番: createApp(await createAppContainer())
 * - テスト: createApp(createTestContainer()) ※ test/helpers/testContainer.ts
 */
import type { AwilixContainer } from 'awilix'
import { appConfig } from './env/index.js'
import { createRoutes } from './presentation/routes/index.js'
import type { Cradle } from './di/container.js'

export function createApp(container: AwilixContainer<Cradle>) {
  return createRoutes(container, appConfig)
}

export { createAppContainer } from './di/container.js'
