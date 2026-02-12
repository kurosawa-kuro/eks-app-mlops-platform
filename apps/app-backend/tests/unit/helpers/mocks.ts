import { jest } from '@jest/globals'
import type { Logger } from 'pino'
import type {
  EnvConfig,
  IPostgresAdapter,
  IUserRepository,
  IPasswordService,
  IPrometheusFormatter,
  IJwtService,
  ICookieService,
  IAuthService,
  ITokenBlacklist,
  IHealthService,
  IMetricsService,
  IFirehoseService,
  IErrorLogService,
  ErrorLogDetail,
  LoginResultWithTokens,
  RefreshResult,
} from '../../../src/container/types.js'
import type { User, AuthPayload, LoginResult } from '../../../src/domain/types/auth.js'
import type { ConnectionResult, HealthStatus, MetricsData } from '../../../src/domain/types/health.js'
import type { FirehoseSendResult } from '../../../src/domain/types/firehose.js'

/**
 * Mock environment configuration
 */
export const mockEnv: EnvConfig = {
  PORT: 8000,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-key-for-jwt-minimum-32-chars',
  JWT_EXPIRY_SECONDS: 3600,
  ACCESS_TOKEN_TTL: 900,
  REFRESH_TOKEN_TTL: 604800,
  TOKEN_BLACKLIST_STORE: 'memory',
  RATE_LIMIT_STORE: 'memory',
  LOG_MODE: 'console',
  AWS_REGION: 'ap-northeast-1',
  ENABLE_ANALYTICS_API: false,
  ENABLE_LLM_API: false,
}

/**
 * Mock logger (silent in tests)
 */
export const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
} as unknown as Logger

/**
 * Mock user for testing
 */
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: '$2a$10$iCWWVnl9G9E5i7xPEBr2vOUrSFCrwRLpN8D9AEd0cgaKWLdUveiSy',
}

/**
 * Mock auth payload
 */
export const mockAuthPayload: AuthPayload = {
  sub: 'test-user-id',
  email: 'test@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
}

/**
 * Create mock PostgresAdapter
 */
export function createMockPostgresAdapter(overrides?: Partial<IPostgresAdapter>): IPostgresAdapter {
  return {
    testConnection: jest.fn<() => Promise<ConnectionResult>>().mockResolvedValue({ success: true, message: 'Connected to PostgreSQL' }),
    ...overrides,
  }
}

/**
 * Create mock UserRepository
 */
export function createMockUserRepository(overrides?: Partial<IUserRepository>): IUserRepository {
  return {
    findByEmail: jest.fn<() => Promise<User | null>>().mockResolvedValue(mockUser),
    validateCredentials: jest.fn<() => Promise<User | null>>().mockResolvedValue(mockUser),
    ...overrides,
  }
}

/**
 * Create mock JwtService
 */
export function createMockJwtService(overrides?: Partial<IJwtService>): IJwtService {
  return {
    createToken: jest.fn<() => Promise<string>>().mockResolvedValue('mock-jwt-token'),
    createRefreshToken: jest.fn<() => Promise<string>>().mockResolvedValue('mock-refresh-token'),
    verifyToken: jest.fn<() => Promise<AuthPayload | null>>().mockResolvedValue(mockAuthPayload),
    verifyRefreshToken: jest.fn<() => Promise<AuthPayload | null>>().mockResolvedValue(mockAuthPayload),
    ...overrides,
  }
}

/**
 * Create mock TokenBlacklist
 */
export function createMockTokenBlacklist(overrides?: Partial<ITokenBlacklist>): ITokenBlacklist {
  return {
    add: jest.fn<() => Promise<void>>().mockResolvedValue(),
    isBlacklisted: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    ...overrides,
  }
}

/**
 * Create mock CookieService
 */
export function createMockCookieService(overrides?: Partial<ICookieService>): ICookieService {
  return {
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    getAuthToken: jest.fn<() => string | undefined>().mockReturnValue('mock-auth-token'),
    ...overrides,
  }
}

/**
 * Create mock AuthService
 */
export function createMockAuthService(overrides?: Partial<IAuthService>): IAuthService {
  return {
    login: jest.fn<() => Promise<LoginResultWithTokens>>().mockResolvedValue({
      success: true,
      message: 'Login successful',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    }),
    logout: jest.fn<() => Promise<LoginResult>>().mockResolvedValue({ success: true, message: 'Logout successful' }),
    refresh: jest.fn<() => Promise<RefreshResult>>().mockResolvedValue({
      success: true,
      message: 'Token refreshed',
      accessToken: 'new-mock-access-token',
    }),
    verifyRequest: jest.fn<() => Promise<AuthPayload | null>>().mockResolvedValue(mockAuthPayload),
    ...overrides,
  }
}

/**
 * Create mock HealthService
 */
export function createMockHealthService(overrides?: Partial<IHealthService>): IHealthService {
  return {
    getStatus: jest.fn<() => HealthStatus>().mockReturnValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 100,
    }),
    testPostgres: jest.fn<() => Promise<ConnectionResult>>().mockResolvedValue({ success: true, message: 'Connected to PostgreSQL' }),
    ...overrides,
  }
}

/**
 * Create mock MetricsService
 */
export function createMockMetricsService(overrides?: Partial<IMetricsService>): IMetricsService {
  return {
    recordRequest: jest.fn(),
    recordError: jest.fn(),
    getMetrics: jest.fn<() => MetricsData>().mockReturnValue({ httpRequestsTotal: 0, httpErrorsTotal: 0 }),
    getPrometheusOutput: jest.fn<() => string>().mockReturnValue('# HELP http_requests_total\nhttp_requests_total 0'),
    ...overrides,
  }
}

/**
 * Create mock FirehoseService
 */
export function createMockFirehoseService(overrides?: Partial<IFirehoseService>): IFirehoseService {
  return {
    sendLog: jest.fn(),
    sendLogAsync: jest.fn<() => Promise<FirehoseSendResult>>().mockResolvedValue({
      success: true,
      recordId: 'mock-record-id',
    }),
    isEnabled: jest.fn<() => boolean>().mockReturnValue(true),
    ...overrides,
  }
}

/**
 * Create mock PasswordService
 */
export function createMockPasswordService(overrides?: Partial<IPasswordService>): IPasswordService {
  return {
    hash: jest.fn<(password: string, saltRounds?: number) => Promise<string>>().mockResolvedValue('$2a$10$mockhash'),
    verify: jest.fn<(password: string, hash: string) => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  }
}

/**
 * Create mock PrometheusFormatter
 */
export function createMockPrometheusFormatter(overrides?: Partial<IPrometheusFormatter>): IPrometheusFormatter {
  return {
    format: jest.fn<(metrics: MetricsData) => string>().mockReturnValue('# HELP http_requests_total\nhttp_requests_total 0'),
    ...overrides,
  }
}

/**
 * Create mock ErrorLogService
 */
export function createMockErrorLogService(overrides?: Partial<IErrorLogService>): IErrorLogService {
  return {
    logError: jest.fn(),
    logErrorAsync: jest.fn<(message: string, detail: ErrorLogDetail) => Promise<void>>().mockResolvedValue(),
    isEnabled: jest.fn<() => boolean>().mockReturnValue(false),
    ...overrides,
  }
}

/**
 * Create mock PrismaClient for health checks
 */
export function createMockPrismaClient(options?: { queryRawFails?: boolean }) {
  return {
    $queryRaw: options?.queryRawFails
      ? jest.fn().mockRejectedValue(new Error('Connection failed'))
      : jest.fn().mockResolvedValue([{ connected: 1 }]),
  }
}
