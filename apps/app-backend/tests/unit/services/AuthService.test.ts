import { jest } from '@jest/globals'
import { AuthService } from '../../../src/services/AuthService.js'
import {
  mockLogger,
  mockUser,
  mockEnv,
  createMockUserRepository,
  createMockJwtService,
  createMockCookieService,
  createMockTokenBlacklist,
} from '../helpers/index.js'

describe('AuthService', () => {
  let authService: AuthService
  let mockUserRepository: ReturnType<typeof createMockUserRepository>
  let mockJwtService: ReturnType<typeof createMockJwtService>
  let mockCookieService: ReturnType<typeof createMockCookieService>
  let mockTokenBlacklist: ReturnType<typeof createMockTokenBlacklist>
  let mockContext: any

  beforeEach(() => {
    mockUserRepository = createMockUserRepository()
    mockJwtService = createMockJwtService()
    mockCookieService = createMockCookieService()
    mockTokenBlacklist = createMockTokenBlacklist()
    authService = new AuthService(
      mockUserRepository,
      mockJwtService,
      mockCookieService,
      mockTokenBlacklist,
      mockEnv,
      mockLogger,
      null, // authServiceClient (not used in these tests)
    )
    mockContext = {}
  })

  describe('login', () => {
    it('should validate credentials with repository', async () => {
      const credentials = { email: 'test@example.com', password: 'password' }
      await authService.login(mockContext, credentials)
      expect(mockUserRepository.validateCredentials).toHaveBeenCalledWith(credentials)
    })

    it('should create token on valid credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'password' }
      await authService.login(mockContext, credentials)
      expect(mockJwtService.createToken).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      })
    })

    it('should set auth token cookie', async () => {
      const credentials = { email: 'test@example.com', password: 'password' }
      await authService.login(mockContext, credentials)
      expect(mockCookieService.setAuthToken).toHaveBeenCalledWith(mockContext, 'mock-jwt-token')
    })

    it('should return success on valid credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'password' }
      const result = await authService.login(mockContext, credentials)
      expect(result.success).toBe(true)
      expect(result.message).toBe('Login successful')
    })

    it('should log user login', async () => {
      const credentials = { email: 'test@example.com', password: 'password' }
      await authService.login(mockContext, credentials)
      expect(mockLogger.info).toHaveBeenCalledWith({ userId: mockUser.id }, 'User logged in via local DB')
    })
  })

  describe('logout', () => {
    it('should clear auth token cookie', async () => {
      await authService.logout(mockContext)
      expect(mockCookieService.clearAuthToken).toHaveBeenCalledWith(mockContext)
    })

    it('should return success', async () => {
      const result = await authService.logout(mockContext)
      expect(result.success).toBe(true)
      expect(result.message).toBe('Logout successful')
    })

    it('should add token to blacklist', async () => {
      await authService.logout(mockContext)
      expect(mockTokenBlacklist.add).toHaveBeenCalled()
    })

    it('should get token from Authorization header when cookie is not present', async () => {
      mockCookieService.getAuthToken.mockReturnValue(undefined)
      const contextWithAuthHeader = {
        req: {
          header: jest.fn().mockReturnValue('Bearer header-token'),
        },
      }
      await authService.logout(contextWithAuthHeader)
      expect(mockTokenBlacklist.add).toHaveBeenCalledWith('header-token', expect.any(Date))
    })

    it('should prefer cookie token over Authorization header', async () => {
      mockCookieService.getAuthToken.mockReturnValue('cookie-token')
      const contextWithAuthHeader = {
        req: {
          header: jest.fn().mockReturnValue('Bearer header-token'),
        },
      }
      await authService.logout(contextWithAuthHeader)
      expect(mockTokenBlacklist.add).toHaveBeenCalledWith('cookie-token', expect.any(Date))
    })
  })

  describe('verifyRequest', () => {
    it('should get auth token from cookie', async () => {
      await authService.verifyRequest(mockContext)
      expect(mockCookieService.getAuthToken).toHaveBeenCalledWith(mockContext)
    })

    it('should verify token with jwt service', async () => {
      await authService.verifyRequest(mockContext)
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith('mock-auth-token')
    })

    it('should return auth payload on valid token', async () => {
      const payload = await authService.verifyRequest(mockContext)
      expect(payload).not.toBeNull()
      expect(payload?.sub).toBe('test-user-id')
      expect(payload?.email).toBe('test@example.com')
    })
  })
})
