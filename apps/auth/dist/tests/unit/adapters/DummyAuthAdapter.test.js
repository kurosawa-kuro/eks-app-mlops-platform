import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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
describe('DummyAuthAdapter', () => {
    let adapter;
    let blacklist;
    let jwtService;
    beforeEach(() => {
        jest.clearAllMocks();
        blacklist = new InMemoryBlacklist(mockLogger);
        jwtService = new JwtService(mockEnv, mockLogger);
        adapter = new DummyAuthAdapter(blacklist, jwtService, mockEnv, mockLogger);
    });
    describe('login', () => {
        it('should login admin user with correct credentials', async () => {
            const result = await adapter.login({ username: 'admin', password: 'password' });
            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.expiresIn).toBe(3600);
            expect(result.user?.id).toBe('dummy-admin-id');
            expect(result.user?.email).toBe('admin@example.com');
        });
        it('should login regular user with correct credentials', async () => {
            const result = await adapter.login({ username: 'user', password: 'password' });
            expect(result.success).toBe(true);
            expect(result.user?.id).toBe('dummy-user-id');
            expect(result.user?.email).toBe('user@example.com');
        });
        it('should login viewer with correct credentials', async () => {
            const result = await adapter.login({ username: 'viewer', password: 'password' });
            expect(result.success).toBe(true);
            expect(result.user?.id).toBe('dummy-viewer-id');
            expect(result.user?.email).toBe('viewer@example.com');
        });
        it('should return tokens with correct JWT format', async () => {
            const result = await adapter.login({ username: 'admin', password: 'password' });
            expect(result.accessToken.split('.')).toHaveLength(3);
            expect(result.refreshToken.split('.')).toHaveLength(3);
        });
    });
    describe('verify', () => {
        it('should verify a valid access token', async () => {
            const loginResult = await adapter.login({ username: 'admin', password: 'password' });
            const result = await adapter.verify(loginResult.accessToken);
            expect(result.success).toBe(true);
            expect(result.payload?.sub).toBe('dummy-admin-id');
            expect(result.payload?.email).toBe('admin@example.com');
            expect(result.payload?.role).toBe('admin');
        });
        it('should include iat and exp in payload', async () => {
            const loginResult = await adapter.login({ username: 'user', password: 'password' });
            const result = await adapter.verify(loginResult.accessToken);
            expect(result.payload?.iat).toBeDefined();
            expect(result.payload?.exp).toBeDefined();
            expect(result.payload.exp).toBeGreaterThan(result.payload.iat);
        });
        it('should return correct role for each user', async () => {
            const adminLogin = await adapter.login({ username: 'admin', password: 'password' });
            const userLogin = await adapter.login({ username: 'user', password: 'password' });
            const viewerLogin = await adapter.login({ username: 'viewer', password: 'password' });
            const adminVerify = await adapter.verify(adminLogin.accessToken);
            const userVerify = await adapter.verify(userLogin.accessToken);
            const viewerVerify = await adapter.verify(viewerLogin.accessToken);
            expect(adminVerify.payload?.role).toBe('admin');
            expect(userVerify.payload?.role).toBe('user');
            expect(viewerVerify.payload?.role).toBe('guest');
        });
        it('should reject blacklisted token', async () => {
            const loginResult = await adapter.login({ username: 'admin', password: 'password' });
            await adapter.logout(loginResult.accessToken);
            const result = await adapter.verify(loginResult.accessToken);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Token has been revoked');
        });
    });
    describe('refresh', () => {
        it('should return new access token from valid refresh token', async () => {
            const loginResult = await adapter.login({ username: 'admin', password: 'password' });
            const result = await adapter.refresh(loginResult.refreshToken);
            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();
            expect(result.accessToken.split('.')).toHaveLength(3);
            expect(result.expiresIn).toBe(3600);
        });
        it('should produce a verifiable access token after refresh', async () => {
            const loginResult = await adapter.login({ username: 'admin', password: 'password' });
            const refreshResult = await adapter.refresh(loginResult.refreshToken);
            const verifyResult = await adapter.verify(refreshResult.accessToken);
            expect(verifyResult.success).toBe(true);
            expect(verifyResult.payload?.sub).toBe('dummy-admin-id');
        });
    });
    describe('logout', () => {
        it('should blacklist access token on logout', async () => {
            const loginResult = await adapter.login({ username: 'admin', password: 'password' });
            const result = await adapter.logout(loginResult.accessToken);
            expect(result.success).toBe(true);
            const isBlacklisted = await blacklist.isBlacklisted(loginResult.accessToken);
            expect(isBlacklisted).toBe(true);
        });
    });
});
