import type { Logger } from 'pino'
import type { Context } from 'hono'
import type { AwilixContainer } from 'awilix'
import type {
  User,
  Credentials,
  AuthPayload,
  LoginResult,
  UserRole,
} from '../domain/types/auth.js'
import type {
  HealthStatus,
  ConnectionResult,
  MetricsData,
} from '../domain/types/health.js'
import type {
  FirehoseLogRecord,
  FirehoseSendResult,
} from '../domain/types/firehose.js'
import type { AnalyticsData, AnalyticsResult, SentimentData } from '../domain/types/analytics.js'
import type {
  Product,
  Cart,
  Order,
  AuditLog,
  AuditLogFilter,
} from '../domain/types/shop.js'
import type { IRateLimitStore } from '../adapters/cache/index.js'
import type { ITokenBlacklist } from '../adapters/token/index.js'

// Re-export for convenience
export type { IRateLimitStore, RateLimitEntry } from '../adapters/cache/index.js'
export type { ITokenBlacklist } from '../adapters/token/index.js'

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  PORT: number
  NODE_ENV: 'development' | 'production' | 'test'
  DATABASE_URL?: string
  JWT_SECRET: string
  JWT_EXPIRY_SECONDS: number
  // Token TTL configuration
  ACCESS_TOKEN_TTL: number
  REFRESH_TOKEN_TTL: number
  // CSRF protection
  ALLOWED_ORIGIN?: string
  // Token blacklist storage
  TOKEN_BLACKLIST_STORE: 'memory' | 'redis'
  // Rate limit storage
  RATE_LIMIT_STORE: 'memory' | 'redis'
  REDIS_URL?: string
  LOG_MODE: 'console' | 'firehose'
  FIREHOSE_STREAM_NAME?: string
  AWS_REGION: string
  // Analytics API configuration (staging-only)
  ENABLE_ANALYTICS_API: boolean
  ANALYTICS_S3_BUCKET?: string
  // Error logging (CloudWatch Logs)
  ERROR_LOG_GROUP?: string
  // External auth service URL (for delegating token verification)
  AUTH_SERVICE_URL?: string
  // LLM proxy configuration (internal)
  ENABLE_LLM_API: boolean
  LLM_INFERENCE_URL?: string
  LLM_EMBEDDINGS_URL?: string
}

/**
 * PostgreSQL database adapter interface
 */
export interface IPostgresAdapter {
  testConnection(): Promise<ConnectionResult>
}

/**
 * User repository interface for data access
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById?(id: string): Promise<User | null>
  create?(email: string, role?: UserRole): Promise<User>
  validateCredentials(credentials: Credentials): Promise<User | null>
}

/**
 * JWT service interface for token operations
 */
export interface IJwtService {
  createToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string>
  createRefreshToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string>
  verifyToken(token: string): Promise<AuthPayload | null>
  verifyRefreshToken(token: string): Promise<AuthPayload | null>
}

/**
 * Cookie service interface for cookie management
 */
export interface ICookieService {
  setAuthToken(c: Context, token: string): void
  clearAuthToken(c: Context): void
  getAuthToken(c: Context): string | undefined
}

/**
 * Login result with tokens
 */
export interface LoginResultWithTokens extends LoginResult {
  accessToken?: string
  refreshToken?: string
}

/**
 * Refresh result
 */
export interface RefreshResult {
  success: boolean
  message: string
  accessToken?: string
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  login(c: Context, credentials: Credentials): Promise<LoginResultWithTokens>
  logout(c: Context): Promise<LoginResult>
  refresh(refreshToken: string): Promise<RefreshResult>
  verifyRequest(c: Context): Promise<AuthPayload | null>
}

/**
 * Login result from external auth service
 */
export interface ExternalLoginResult {
  success: boolean
  message: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}

/**
 * External auth service client interface
 * Used for delegating authentication to external services (e.g., Cognito via auth-gateway)
 */
export interface IAuthServiceClient {
  verifyToken(token: string): Promise<AuthPayload | null>
  login(credentials: { email: string; password: string }): Promise<ExternalLoginResult>
  extractRoleFromJwt(token: string): 'admin' | 'user'
}

/**
 * Health check service interface
 */
export interface IHealthService {
  getStatus(): Promise<HealthStatus>
  testPostgres(): Promise<ConnectionResult>
}

/**
 * Metrics service interface
 */
export interface IMetricsService {
  recordRequest(): void
  recordError(): void
  getMetrics(): MetricsData
  getPrometheusOutput(): string
}

/**
 * Access log service interface for request logging
 * Implementations: FirehoseService (production), ConsoleLogService (development)
 */
export interface IAccessLogService {
  /**
   * Send a log record (fire-and-forget)
   * Does not throw - failures are logged internally
   */
  sendLog(record: FirehoseLogRecord): void

  /**
   * Send a log record and wait for result (for testing)
   */
  sendLogAsync(record: FirehoseLogRecord): Promise<FirehoseSendResult>

  /**
   * Check if the service is configured and ready
   */
  isEnabled(): boolean
}

/**
 * Password service interface for hashing operations
 * DI対応: テスト時のモック差し替えが可能
 */
export interface IPasswordService {
  hash(password: string, saltRounds?: number): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}

/**
 * Prometheus formatter interface for metrics output
 * SRP: MetricsServiceから出力責務を分離
 */
export interface IPrometheusFormatter {
  format(metrics: MetricsData): string
}

/**
 * S3 adapter interface for reading analytics files
 */
export interface IS3Adapter {
  getObject<T>(bucket: string, key: string): Promise<AnalyticsResult<T>>
}

/**
 * Analytics service interface for reading pre-computed analytics from S3
 */
export interface IAnalyticsService {
  getAnalytics(): Promise<AnalyticsResult<AnalyticsData>>
  getSentiment(): Promise<AnalyticsResult<SentimentData>>
  isEnabled(): boolean
}

// =============================================================================
// EC Shop Repository Interfaces
// =============================================================================

/**
 * Product repository interface (JSON file read)
 */
export interface IProductRepository {
  findAll(): Promise<Product[]>
  findById(id: string): Promise<Product | null>
}

/**
 * Cart repository interface (async for DB support)
 */
export interface ICartRepository {
  getCart(userId: string): Promise<Cart>
  addItem(userId: string, productId: string, qty?: number): Promise<void>
  removeItem(userId: string, productId: string): Promise<void>
  clearCart(userId: string): Promise<void>
}

/**
 * Order repository interface (async for DB support)
 */
export interface IOrderRepository {
  create(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order>
  findByUserId(userId: string): Promise<Order[]>
  findById(id: string): Promise<Order | null>
}

/**
 * Audit log repository interface (async for DB support)
 */
export interface IAuditRepository {
  add(log: Omit<AuditLog, 'id' | 'ts'>): Promise<void>
  findAll(): Promise<AuditLog[]>
  findByUserId(userId: string): Promise<AuditLog[]>
  findWithFilter(filter: AuditLogFilter): Promise<AuditLog[]>
  /** Get distinct action values for filter dropdown */
  getDistinctActions(): Promise<string[]>
}

// =============================================================================
// EC Shop Service Interfaces
// =============================================================================

/**
 * Product service interface
 */
export interface IProductService {
  findAll(): Promise<Product[]>
  findById(id: string): Promise<Product | null>
}

/**
 * Cart service interface (async for DB support)
 */
export interface ICartService {
  getCart(userId: string): Promise<Cart>
  getCartWithProducts(userId: string): Promise<{ cart: Cart; products: Map<string, Product> }>
  addItem(userId: string, productId: string, qty?: number): Promise<void>
  removeItem(userId: string, productId: string): Promise<void>
  clearCart(userId: string): Promise<void>
}

/**
 * Order service interface (async for DB support)
 */
export interface IOrderService {
  checkout(userId: string): Promise<Order | null>
  findByUserId(userId: string): Promise<Order[]>
  findById(id: string): Promise<Order | null>
}

/**
 * Shop audit service interface (async for DB support)
 */
export interface IShopAuditService {
  log(userId: string, action: string, detail?: Record<string, unknown>): Promise<void>
  findAll(): Promise<AuditLog[]>
  findByUserId(userId: string): Promise<AuditLog[]>
  findWithFilter(filter: AuditLogFilter): Promise<AuditLog[]>
  /** Get distinct action values for filter dropdown */
  getDistinctActions(): Promise<string[]>
}

/**
 * Error log detail for CloudWatch
 */
export interface ErrorLogDetail {
  error: string
  stack?: string
  path: string
  method: string
  statusCode: number
  requestId?: string
}

/**
 * Error log service interface for CloudWatch error logging
 */
export interface IErrorLogService {
  /**
   * Send error log (fire-and-forget)
   */
  logError(message: string, detail: ErrorLogDetail): void

  /**
   * Send error log and wait for result
   */
  logErrorAsync(message: string, detail: ErrorLogDetail): Promise<void>

  /**
   * Check if error logging is enabled
   */
  isEnabled(): boolean
}

/**
 * DI Container cradle - all registered dependencies
 */
export interface Cradle {
  // Config
  env: EnvConfig
  logger: Logger

  // Adapters
  postgresAdapter: IPostgresAdapter
  s3Adapter: IS3Adapter
  rateLimitStore: IRateLimitStore
  tokenBlacklist: ITokenBlacklist

  // Repositories
  userRepository: IUserRepository

  // Formatters
  prometheusFormatter: IPrometheusFormatter

  // Services
  passwordService: IPasswordService
  jwtService: IJwtService
  cookieService: ICookieService
  authService: IAuthService
  authServiceClient: IAuthServiceClient | null
  healthService: IHealthService
  metricsService: IMetricsService
  accessLogService: IAccessLogService
  analyticsService: IAnalyticsService
  errorLogService: IErrorLogService

  // EC Shop Repositories
  productRepository: IProductRepository
  cartRepository: ICartRepository
  orderRepository: IOrderRepository
  auditRepository: IAuditRepository

  // EC Shop Services
  productService: IProductService
  cartService: ICartService
  orderService: IOrderService
  shopAuditService: IShopAuditService
}

/**
 * Application container type
 */
export type AppContainer = AwilixContainer<Cradle>
