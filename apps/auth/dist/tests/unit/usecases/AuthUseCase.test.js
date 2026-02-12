import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthUseCase } from '../../../src/usecases/AuthUseCase.js';
import { DummyAuthAdapter } from '../../../src/adapters/auth/DummyAuthAdapter.js';
import { InMemoryBlacklist } from '../../../src/adapters/blacklist/InMemoryBlacklist.js';
import { JwtService } from '../../../src/services/JwtService.js';
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
const mockEnv = {
    JWT_SECRET: 'test-secret-key-for-jwt-testing-32chars!',
    ACCESS_TOKEN_TTL: 3600,
    REFRESH_TOKEN_TTL: 604800,
};
describe('AuthUseCase', () => {
    let useCase;
    let adapter;
    let blacklist;
    beforeEach(() => {
        jest.clearAllMocks();
        blacklist = new InMemoryBlacklist(mockLogger);
        const jwtService = new JwtService(mockEnv, mockLogger);
        adapter = new DummyAuthAdapter(blacklist, jwtService, mockEnv, mockLogger);
        useCase = new AuthUseCase(adapter, mockEnv, mockLogger);
    });
    describe('login', () => {
        it('should return accessToken and refreshToken on success', async () => {
            const result = await useCase.login({ username: 'admin', password: 'password' });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Login successful');
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.expiresIn).toBe(3600);
        });
        it('should return failure for wrong password', async () => {
            const result = await useCase.login({ username: 'admin', password: 'wrong' });
            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid credentials');
            expect(result.accessToken).toBeUndefined();
        });
    });
    describe('verify', () => {
        it('should verify token and return user payload', async () => {
            const loginResult = await useCase.login({ username: 'admin', password: 'password' });
            const result = await useCase.verify(loginResult.accessToken);
            expect(result.success).toBe(true);
            expect(result.payload?.sub).toBe('dummy-admin-id');
            expect(result.payload?.email).toBe('admin@example.com');
            expect(result.payload?.role).toBe('admin');
        });
        it('should return false for invalid token', async () => {
            const result = await useCase.verify('invalid-token');
            expect(result.success).toBe(false);
            expect(result.payload).toBeUndefined();
        });
    });
    describe('refresh', () => {
        it('should return new access token from refresh token', async () => {
            const loginResult = await useCase.login({ username: 'user', password: 'password' });
            const result = await useCase.refresh(loginResult.refreshToken);
            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();
            expect(result.expiresIn).toBe(3600);
        });
        it('should return failure for invalid refresh token', async () => {
            const result = await useCase.refresh('invalid-refresh-token');
            expect(result.success).toBe(false);
        });
    });
    describe('logout', () => {
        it('should blacklist token so verify fails after logout', async () => {
            const loginResult = await useCase.login({ username: 'admin', password: 'password' });
            await useCase.logout(loginResult.accessToken);
            const verifyResult = await useCase.verify(loginResult.accessToken);
            expect(verifyResult.success).toBe(false);
        });
    });
    describe('accessTokenTTL', () => {
        it('should return configured TTL value', () => {
            expect(useCase.accessTokenTTL).toBe(3600);
        });
    });
});
