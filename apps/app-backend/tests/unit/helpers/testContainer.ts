import { createContainer, asValue, InjectionMode } from 'awilix'
import type { Cradle, AppContainer } from '../../../src/container/types.js'
import {
  mockEnv,
  mockLogger,
  createMockPostgresAdapter,
  createMockUserRepository,
  createMockPasswordService,
  createMockPrometheusFormatter,
  createMockJwtService,
  createMockCookieService,
  createMockAuthService,
  createMockHealthService,
  createMockMetricsService,
  createMockFirehoseService,
} from './mocks.js'

export type MockOverrides = {
  [K in keyof Cradle]?: Cradle[K]
}

/**
 * Create a test container with all mocked dependencies
 * Allows overriding specific mocks for individual tests
 */
export function createTestContainer(overrides: MockOverrides = {}): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC,
  })

  container.register({
    env: asValue(overrides.env ?? mockEnv),
    logger: asValue(overrides.logger ?? mockLogger),
    postgresAdapter: asValue(overrides.postgresAdapter ?? createMockPostgresAdapter()),
    userRepository: asValue(overrides.userRepository ?? createMockUserRepository()),
    prometheusFormatter: asValue(overrides.prometheusFormatter ?? createMockPrometheusFormatter()),
    passwordService: asValue(overrides.passwordService ?? createMockPasswordService()),
    jwtService: asValue(overrides.jwtService ?? createMockJwtService()),
    cookieService: asValue(overrides.cookieService ?? createMockCookieService()),
    authService: asValue(overrides.authService ?? createMockAuthService()),
    healthService: asValue(overrides.healthService ?? createMockHealthService()),
    metricsService: asValue(overrides.metricsService ?? createMockMetricsService()),
    firehoseService: asValue(overrides.firehoseService ?? createMockFirehoseService()),
  })

  return container
}

/**
 * Helper to resolve a dependency from a test container
 */
export function resolveFromContainer<K extends keyof Cradle>(
  container: AppContainer,
  name: K,
): Cradle[K] {
  return container.resolve(name)
}
