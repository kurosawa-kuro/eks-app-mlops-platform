import { describe, it, expect } from 'vitest'
import { logger } from '../../../src/shared/logger.js'

describe('logger', () => {
  it('should be a pino logger instance', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })
})
