import bcrypt from 'bcryptjs'
import type { IPasswordService } from '../container/types.js'

/**
 * Service for password hashing and verification
 * Uses bcrypt for secure password handling
 *
 * DI対応: インスタンスベースでテスト時のモック差し替えが可能
 */
export class PasswordService implements IPasswordService {
  /**
   * Hash a plain text password
   * @param password - Plain text password to hash
   * @param saltRounds - Number of salt rounds (default: 10)
   * @returns Hashed password
   */
  async hash(password: string, saltRounds: number = 10): Promise<string> {
    return await bcrypt.hash(password, saltRounds)
  }

  /**
   * Verify a plain text password against a hash
   * @param password - Plain text password to verify
   * @param hash - Hashed password to compare against
   * @returns True if password matches, false otherwise
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }
}
