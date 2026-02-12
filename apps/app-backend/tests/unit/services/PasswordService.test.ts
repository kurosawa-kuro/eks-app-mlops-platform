import { PasswordService } from '../../../src/services/PasswordService.js'

describe('PasswordService', () => {
  let passwordService: PasswordService

  beforeEach(() => {
    passwordService = new PasswordService()
  })

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123'
      const hash = await passwordService.hash(password)
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })

    it('should generate different hash each time', async () => {
      const password = 'testPassword123'
      const hash1 = await passwordService.hash(password)
      const hash2 = await passwordService.hash(password)
      expect(hash1).not.toBe(hash2)
    })

    it('should generate bcrypt formatted hash', async () => {
      const password = 'testPassword123'
      const hash = await passwordService.hash(password)
      expect(hash).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/)
    })
  })

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123'
      const hash = await passwordService.hash(password)
      const isValid = await passwordService.verify(password, hash)
      expect(isValid).toBe(true)
    })

    it('should verify against known hash', async () => {
      const password = 'password'
      const knownHash = '$2a$10$iCWWVnl9G9E5i7xPEBr2vOUrSFCrwRLpN8D9AEd0cgaKWLdUveiSy'
      const isValid = await passwordService.verify(password, knownHash)
      expect(isValid).toBe(true)
    })
  })
})
