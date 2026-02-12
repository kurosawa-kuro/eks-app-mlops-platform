import { PrismaClient } from '@prisma/client'
import type { IUserRepository } from '../container/types.js'
import type { User, Credentials, UserRole } from '../domain/types/auth.js'

/**
 * PostgreSQL user repository using Prisma
 *
 * Note: This repository does NOT validate passwords because:
 * - Users authenticate via external JWT provider (Cognito/Lambda Auth)
 * - No password field in User table
 * - validateCredentials() always returns null (login via JWT only)
 *
 * Usage:
 * - User registration is admin-only (via /api/register)
 * - Authentication is done via JWT (external auth service)
 * - This repository is for user existence/role checks only
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })
    if (!user) return null

    return this.toUser(user)
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    })
    if (!user) return null

    return this.toUser(user)
  }

  async create(email: string, role: UserRole = 'user'): Promise<User> {
    const user = await this.prisma.user.create({
      data: { email, role },
    })
    return this.toUser(user)
  }

  /**
   * JWT-only auth - no password validation
   * Always returns null as authentication is handled by external JWT service
   */
  async validateCredentials(_credentials: Credentials): Promise<User | null> {
    return null
  }

  private toUser(u: { id: string; email: string; role: string }): User {
    return {
      id: u.id,
      email: u.email,
      passwordHash: '', // No password - JWT auth only
      role: u.role as UserRole,
    }
  }
}
