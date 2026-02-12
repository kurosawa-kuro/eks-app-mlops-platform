import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { AppError, Errors } from '../../../src/shared/errors.js'
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js'

describe('Error Handler Middleware', () => {
  describe('AppError', () => {
    it('should create error with message, status, and code', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR')

      expect(error.message).toBe('Test error')
      expect(error.status).toBe(400)
      expect(error.code).toBe('TEST_ERROR')
      expect(error.name).toBe('AppError')
    })
  })

  describe('Errors factory', () => {
    it('should create notFound error with status 404', () => {
      const error = Errors.notFound('User')

      expect(error.message).toBe('User not found')
      expect(error.status).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('should create badRequest error with status 400', () => {
      const error = Errors.badRequest('Invalid input')

      expect(error.message).toBe('Invalid input')
      expect(error.status).toBe(400)
      expect(error.code).toBe('BAD_REQUEST')
    })
  })

  describe('errorHandler', () => {
    it('should return JSON response for API requests with AppError', async () => {
      const app = new Hono()
      app.onError(errorHandler)
      app.get('/api/test', () => {
        throw Errors.notFound('Resource')
      })

      const res = await app.request('/api/test', {
        headers: { Accept: 'application/json' }
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe('Resource not found')
      expect(json.status).toBe(404)
      expect(json.code).toBe('NOT_FOUND')
      expect(json.timestamp).toBeDefined()
    })
  })
})
