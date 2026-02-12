import { describe, it, expect } from 'vitest'
import { AppError, Errors } from '../../../src/shared/errors.js'

describe('AppError', () => {
  it('should create error with all properties', () => {
    const error = new AppError('Test error', 400, 'TEST_CODE', 'cause')

    expect(error.message).toBe('Test error')
    expect(error.status).toBe(400)
    expect(error.code).toBe('TEST_CODE')
    expect(error.cause).toBe('cause')
    expect(error.name).toBe('AppError')
  })
})

describe('Errors factory', () => {
  it('should create notFound error', () => {
    const error = Errors.notFound('User')

    expect(error.message).toBe('User not found')
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should create badRequest error', () => {
    const error = Errors.badRequest('Invalid input')

    expect(error.message).toBe('Invalid input')
    expect(error.status).toBe(400)
    expect(error.code).toBe('BAD_REQUEST')
  })

  it('should create unauthorized error', () => {
    const error = Errors.unauthorized()

    expect(error.message).toBe('Unauthorized')
    expect(error.status).toBe(401)
    expect(error.code).toBe('UNAUTHORIZED')
  })

  it('should create forbidden error', () => {
    const error = Errors.forbidden()

    expect(error.message).toBe('Forbidden')
    expect(error.status).toBe(403)
    expect(error.code).toBe('FORBIDDEN')
  })

  it('should create conflict error', () => {
    const error = Errors.conflict('Already exists')

    expect(error.message).toBe('Already exists')
    expect(error.status).toBe(409)
    expect(error.code).toBe('CONFLICT')
  })

  it('should create internal error', () => {
    const error = Errors.internal()

    expect(error.message).toBe('Internal server error')
    expect(error.status).toBe(500)
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('should create dbNotConfigured error', () => {
    const error = Errors.dbNotConfigured()

    expect(error.message).toBe('Database not configured')
    expect(error.status).toBe(500)
    expect(error.code).toBe('DB_NOT_CONFIGURED')
  })

  it('should create dbUnavailable error with context', () => {
    const cause = new Error('Connection failed')
    const error = Errors.dbUnavailable('settings.get', cause)

    expect(error.message).toBe('Database unavailable: settings.get')
    expect(error.status).toBe(503)
    expect(error.code).toBe('DB_UNAVAILABLE')
    expect(error.cause).toBe(cause)
  })

  it('should create serviceUnavailable error', () => {
    const cause = new Error('timeout')
    const error = Errors.serviceUnavailable('cloudinary', cause)

    expect(error.message).toBe('Service unavailable: cloudinary')
    expect(error.status).toBe(503)
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(error.cause).toBe(cause)
  })
})
