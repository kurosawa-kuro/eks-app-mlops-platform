import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { mockLogger } from '../helpers/mocks.js'
import type { EnvConfig, ErrorLogDetail } from '../../../src/container/types.js'

// Mock command types
interface MockCommand {
  type: string
  input: {
    logGroupName?: string
    logStreamName?: string
    logEvents?: Array<{ timestamp: number; message: string }>
  }
}

// Mock AWS SDK before importing the service
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = jest.fn<any>()
jest.unstable_mockModule('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  CreateLogStreamCommand: jest.fn().mockImplementation((input) => ({ type: 'CreateLogStream', input })),
  PutLogEventsCommand: jest.fn().mockImplementation((input) => ({ type: 'PutLogEvents', input })),
}))

// Dynamic import after mocking
const { CloudWatchErrorLogService } = await import('../../../src/services/logs/Error/CloudWatchErrorLogService.js')

describe('CloudWatchErrorLogService', () => {
  let errorLogService: InstanceType<typeof CloudWatchErrorLogService>
  let mockEnv: EnvConfig

  const sampleErrorDetail: ErrorLogDetail = {
    error: 'Test error message',
    stack: 'Error: Test error\n  at test.ts:1:1',
    path: '/api/test',
    method: 'POST',
    statusCode: 500,
    requestId: 'req-456',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSend.mockResolvedValue({})
    mockEnv = {
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
      ERROR_LOG_GROUP: '/hono-app/errors',
      ENABLE_ANALYTICS_API: false,
      ENABLE_LLM_API: false,
      ECSHOP_STORAGE_MODE: 'memory',
    }
  })

  describe('initialization', () => {
    it('should be enabled when ERROR_LOG_GROUP is set', () => {
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      expect(errorLogService.isEnabled()).toBe(true)
    })

    it('should be disabled when ERROR_LOG_GROUP is not set', () => {
      mockEnv.ERROR_LOG_GROUP = undefined
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      expect(errorLogService.isEnabled()).toBe(false)
    })

    it('should create log stream on initialization', async () => {
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockSend).toHaveBeenCalled()
      const createCommand = mockSend.mock.calls[0]![0] as unknown as MockCommand
      expect(createCommand.type).toBe('CreateLogStream')
      expect(createCommand.input.logGroupName).toBe('/hono-app/errors')
    })

    it('should log initialization when enabled', () => {
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          logGroup: '/hono-app/errors',
        }),
        'CloudWatch error log service initialized'
      )
    })
  })

  describe('logErrorAsync', () => {
    beforeEach(async () => {
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10))
      mockSend.mockClear()
    })

    it('should send error log successfully', async () => {
      await errorLogService.logErrorAsync('Unhandled Error', sampleErrorDetail)

      expect(mockSend).toHaveBeenCalledTimes(1)
      const command = mockSend.mock.calls[0]![0] as unknown as MockCommand
      expect(command.type).toBe('PutLogEvents')
    })

    it('should send correct log format', async () => {
      await errorLogService.logErrorAsync('Unhandled Error', sampleErrorDetail)

      const command = mockSend.mock.calls[0]![0] as unknown as MockCommand
      expect(command.input.logGroupName).toBe('/hono-app/errors')

      const logEvent = command.input.logEvents![0]
      expect(logEvent.timestamp).toBeDefined()

      const message = JSON.parse(logEvent.message)
      expect(message.message).toBe('Unhandled Error')
      expect(message.error).toBe('Test error message')
      expect(message.path).toBe('/api/test')
      expect(message.method).toBe('POST')
      expect(message.statusCode).toBe(500)
      expect(message.requestId).toBe('req-456')
      expect(message.timestamp).toBeDefined()
    })

    it('should not send when disabled', async () => {
      mockEnv.ERROR_LOG_GROUP = undefined
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      mockSend.mockClear()

      await errorLogService.logErrorAsync('Error', sampleErrorDetail)

      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('logError (fire-and-forget)', () => {
    beforeEach(async () => {
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      await new Promise(resolve => setTimeout(resolve, 10))
      mockSend.mockClear()
    })

    it('should not throw and return immediately', () => {
      expect(() => {
        errorLogService.logError('Error', sampleErrorDetail)
      }).not.toThrow()
    })

    it('should not call send when disabled', () => {
      mockEnv.ERROR_LOG_GROUP = undefined
      errorLogService = new CloudWatchErrorLogService(mockEnv, mockLogger)
      mockSend.mockClear()

      errorLogService.logError('Error', sampleErrorDetail)

      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
