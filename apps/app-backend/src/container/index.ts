import { createContainer, asClass, asValue, asFunction, InjectionMode } from 'awilix'
import { PrismaClient } from '@prisma/client'
import type { Cradle, AppContainer } from './types.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

// Adapters
import { PostgresAdapter } from '../adapters/database/PostgresAdapter.js'
import { S3Adapter } from '../adapters/storage/S3Adapter.js'
import { MockS3Adapter } from '../adapters/storage/MockS3Adapter.js'
import { InMemoryRateLimitStore, RedisRateLimitStore } from '../adapters/cache/index.js'
import { InMemoryTokenBlacklist, RedisTokenBlacklist } from '../adapters/token/index.js'

// Repositories
import { PrismaUserRepository } from '../repositories/PrismaUserRepository.js'
import {
  PrismaProductRepository,
  PrismaCartRepository,
  PrismaOrderRepository,
  PrismaAuditRepository,
} from '../repositories/shop/index.js'
import {
  ProductService,
  CartService,
  OrderService,
  ShopAuditService,
} from '../services/shop/index.js'

// Services
import { PasswordService } from '../services/PasswordService.js'
import { JwtService } from '../services/JwtService.js'
import { CookieService } from '../services/CookieService.js'
import { MetricsService, PrometheusFormatter } from '../services/metrics/index.js'
import { AuthService } from '../services/AuthService.js'
import { AuthServiceClient } from '../services/AuthServiceClient.js'
import { HealthService } from '../services/HealthService.js'
import { AnalyticsService } from '../services/AnalyticsService.js'

// Log Services (organized under logs/)
import {
  FirehoseService,
  ConsoleLogService,
  CloudWatchErrorLogService,
  NullErrorLogService,
} from '../services/logs/index.js'

// Prisma client singleton (lazy initialized)
let prismaClient: PrismaClient | null = null

function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

/**
 * Creates and configures the Awilix DI container
 */
export function createAppContainer(): AppContainer {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC,
  })

  container.register({
    // Config (registered as values)
    env: asValue(env),
    logger: asValue(logger),

    // Adapters (registered as singleton classes)
    postgresAdapter: asClass(PostgresAdapter).singleton(),
    // S3 Adapter: Use real adapter when analytics enabled, mock otherwise
    s3Adapter: env.ENABLE_ANALYTICS_API
      ? asClass(S3Adapter).singleton()
      : asClass(MockS3Adapter).singleton(),

    // Rate limit store: In-memory for single-instance, Redis for distributed
    rateLimitStore: env.RATE_LIMIT_STORE === 'redis'
      ? asClass(RedisRateLimitStore).singleton()
      : asClass(InMemoryRateLimitStore).singleton(),

    // Token blacklist: In-memory for development, Redis for production
    tokenBlacklist: env.TOKEN_BLACKLIST_STORE === 'redis'
      ? asClass(RedisTokenBlacklist).singleton()
      : asClass(InMemoryTokenBlacklist).singleton(),

    // User Repository: Prisma (Neon PostgreSQL)
    userRepository: asFunction(() => new PrismaUserRepository(getPrismaClient())).singleton(),

    // EC Shop Repositories (Prisma/PostgreSQL)
    productRepository: asFunction(() => new PrismaProductRepository(getPrismaClient())).singleton(),
    cartRepository: asFunction(() => new PrismaCartRepository(getPrismaClient())).singleton(),
    orderRepository: asFunction(() => new PrismaOrderRepository(getPrismaClient())).singleton(),
    auditRepository: asFunction(() => new PrismaAuditRepository(getPrismaClient())).singleton(),

    // EC Shop Services
    productService: asClass(ProductService).singleton(),
    cartService: asClass(CartService).singleton(),
    shopAuditService: asClass(ShopAuditService).singleton(),
    // Note: OrderService depends on ShopAuditService, so it's registered after
    orderService: asClass(OrderService).singleton(),

    // Metrics (services/metrics/)
    prometheusFormatter: asClass(PrometheusFormatter).singleton(),
    metricsService: asClass(MetricsService).singleton(),

    // Services
    passwordService: asClass(PasswordService).singleton(),
    jwtService: asClass(JwtService).singleton(),
    cookieService: asClass(CookieService).singleton(),

    // External auth service client: Used for delegating token verification (e.g., Cognito)
    // Returns null if AUTH_SERVICE_URL is not configured
    // Note: Using direct logger import to avoid tsx watch parameter name mangling issue
    authServiceClient: asValue(
      env.AUTH_SERVICE_URL
        ? new AuthServiceClient(env.AUTH_SERVICE_URL, logger)
        : null
    ),

    authService: asClass(AuthService).singleton(),
    healthService: asFunction(() => new HealthService(getPrismaClient(), logger)).singleton(),

    // Access log service: Use Firehose for production, Console for development
    accessLogService: env.LOG_MODE === 'firehose'
      ? asClass(FirehoseService).singleton()
      : asClass(ConsoleLogService).singleton(),

    // Analytics service
    analyticsService: asClass(AnalyticsService).singleton(),

    // Error log service: Use CloudWatch when configured, Null otherwise
    errorLogService: env.ERROR_LOG_GROUP
      ? asClass(CloudWatchErrorLogService).singleton()
      : asClass(NullErrorLogService).singleton(),
  })

  logger.info('EC Shop storage mode: PostgreSQL (Prisma)')

  return container
}

/**
 * Default application container instance
 */
export const container = createAppContainer()

/**
 * Helper function to resolve a dependency from the container
 */
export function resolve<K extends keyof Cradle>(name: K): Cradle[K] {
  return container.resolve(name)
}

/**
 * Disconnect Prisma client (for graceful shutdown)
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect()
    prismaClient = null
  }
}
