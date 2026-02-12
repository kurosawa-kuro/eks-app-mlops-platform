import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { mockLogger } from '../helpers/mocks.js'
import type { EnvConfig } from '../../../src/container/types.js'
import type { FirehoseLogRecord } from '../../../src/domain/types/firehose.js'

// Mock AWS SDK before importing the service
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = jest.fn<any>()
jest.unstable_mockModule('@aws-sdk/client-firehose', () => ({
  FirehoseClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutRecordCommand: jest.fn().mockImplementation((input) => ({ input })),
}))

// Dynamic import after mocking
const { FirehoseService } = await import('../../../src/services/logs/Access/FirehoseService.js')

describe('FirehoseService', () => {
  let firehoseService: InstanceType<typeof FirehoseService>
  let mockEnv: EnvConfig

  const sampleLogRecord: FirehoseLogRecord = {
    timestamp: '2024-01-01T00:00:00.000Z',
    method: 'GET',
    path: '/api/test',
    statusCode: 200,
    durationMs: 50,
    userAgent: 'test-agent',
    ip: '127.0.0.1',
    requestId: 'req-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockEnv = {
      PORT: 8000,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-jwt-minimum-32-chars',
      JWT_EXPIRY_SECONDS: 3600,
      ACCESS_TOKEN_TTL: 900,
      REFRESH_TOKEN_TTL: 604800,
      TOKEN_BLACKLIST_STORE: 'memory',
      RATE_LIMIT_STORE: 'memory',
      LOG_MODE: 'firehose',
      AWS_REGION: 'ap-northeast-1',
      FIREHOSE_STREAM_NAME: 'test-stream',
      ENABLE_ANALYTICS_API: false,
      ENABLE_LLM_API: false,
      ECSHOP_STORAGE_MODE: 'memory',
    }
  })

  describe('initialization', () => {
    it('should be enabled when LOG_MODE is firehose and stream name is set', () => {
      firehoseService = new FirehoseService(mockEnv, mockLogger)
      expect(firehoseService.isEnabled()).toBe(true)
    })

    it('should be disabled when LOG_MODE is console', () => {
      mockEnv.LOG_MODE = 'console'
      firehoseService = new FirehoseService(mockEnv, mockLogger)
      expect(firehoseService.isEnabled()).toBe(false)
    })

    it('should be disabled when stream name is not set', () => {
      mockEnv.FIREHOSE_STREAM_NAME = undefined
      firehoseService = new FirehoseService(mockEnv, mockLogger)
      expect(firehoseService.isEnabled()).toBe(false)
    })

    it('should log initialization when enabled', () => {
      firehoseService = new FirehoseService(mockEnv, mockLogger)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { streamName: 'test-stream', region: 'ap-northeast-1' },
        'Firehose service initialized'
      )
    })
  })

  describe('sendLogAsync', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ RecordId: 'mock-record-id-123' })
      firehoseService = new FirehoseService(mockEnv, mockLogger)
    })

    it('should send log record successfully', async () => {
      const result = await firehoseService.sendLogAsync(sampleLogRecord)

      expect(result.success).toBe(true)
      expect(result.recordId).toBe('mock-record-id-123')
    })

    it('should send correct data format to Firehose', async () => {
      await firehoseService.sendLogAsync(sampleLogRecord)

      expect(mockSend).toHaveBeenCalledTimes(1)
      const command = mockSend.mock.calls[0]![0] as unknown as { input: { DeliveryStreamName: string; Record: { Data: Buffer } } }
      expect(command.input.DeliveryStreamName).toBe('test-stream')

      // Verify data is newline-delimited JSON
      const sentData = command.input.Record.Data.toString('utf-8')
      expect(sentData.endsWith('\n')).toBe(true)

      const parsed = JSON.parse(sentData.trim())
      expect(parsed.method).toBe('GET')
      expect(parsed.path).toBe('/api/test')
      expect(parsed.statusCode).toBe(200)
      expect(parsed.requestId).toBe('req-123')
    })

    it('should return disabled result when not enabled', async () => {
      mockEnv.LOG_MODE = 'console'
      firehoseService = new FirehoseService(mockEnv, mockLogger)

      const result = await firehoseService.sendLogAsync(sampleLogRecord)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('DISABLED')
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('sendLog (fire-and-forget)', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ RecordId: 'mock-record-id' })
      firehoseService = new FirehoseService(mockEnv, mockLogger)
    })

    it('should not throw and return immediately', () => {
      expect(() => {
        firehoseService.sendLog(sampleLogRecord)
      }).not.toThrow()
    })

    it('should not call send when disabled', () => {
      mockEnv.LOG_MODE = 'console'
      firehoseService = new FirehoseService(mockEnv, mockLogger)

      firehoseService.sendLog(sampleLogRecord)

      // Even after a tick, should not have called send
      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
