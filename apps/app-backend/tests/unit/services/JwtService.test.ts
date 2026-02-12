import { JwtService } from '../../../src/services/JwtService.js'
import { mockEnv, createMockTokenBlacklist } from '../helpers/index.js'

describe('JwtService', () => {
  let jwtService: JwtService
  let mockTokenBlacklist: ReturnType<typeof createMockTokenBlacklist>

  beforeEach(() => {
    mockTokenBlacklist = createMockTokenBlacklist()
    jwtService = new JwtService(mockEnv, mockTokenBlacklist)
  })

  describe('createToken', () => {
    it('should create a JWT token', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' }
      const token = await jwtService.createToken(payload)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should create token with correct format', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' }
      const token = await jwtService.createToken(payload)
      const parts = token.split('.')
      expect(parts.length).toBe(3)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' }
      const token = await jwtService.createToken(payload)
      const verified = await jwtService.verifyToken(token)
      expect(verified).not.toBeNull()
      expect(verified?.sub).toBe('user-id')
      expect(verified?.email).toBe('test@example.com')
    })

    it('should return payload with iat and exp', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' }
      const token = await jwtService.createToken(payload)
      const verified = await jwtService.verifyToken(token)
      expect(verified?.iat).toBeDefined()
      expect(verified?.exp).toBeDefined()
      expect(typeof verified?.iat).toBe('number')
      expect(typeof verified?.exp).toBe('number')
    })

    it('should have exp greater than iat', async () => {
      const payload = { sub: 'user-id', email: 'test@example.com' }
      const token = await jwtService.createToken(payload)
      const verified = await jwtService.verifyToken(token)
      expect(verified!.exp).toBeGreaterThan(verified!.iat)
    })
  })
})
