import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JwtService } from '../../../src/services/JwtService.js';
// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Test environment config
const mockEnv = {
    JWT_SECRET: 'test-secret-key-for-jwt-testing',
    ACCESS_TOKEN_TTL: 3600,
    REFRESH_TOKEN_TTL: 604800,
};
describe('JwtService', () => {
    let jwtService;
    beforeEach(() => {
        jest.clearAllMocks();
        jwtService = new JwtService(mockEnv, mockLogger);
    });
    describe('createToken', () => {
        it('should create a valid access token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const token = await jwtService.createToken(payload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });
        it('should log token creation', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            await jwtService.createToken(payload);
            expect(mockLogger.debug).toHaveBeenCalledWith({ sub: 'user-123' }, 'Access token created');
        });
    });
    describe('createRefreshToken', () => {
        it('should create a valid refresh token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const token = await jwtService.createRefreshToken(payload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
        it('should log refresh token creation', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            await jwtService.createRefreshToken(payload);
            expect(mockLogger.debug).toHaveBeenCalledWith({ sub: 'user-123' }, 'Refresh token created');
        });
    });
    describe('verifyToken', () => {
        it('should verify a valid access token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const token = await jwtService.createToken(payload);
            const result = await jwtService.verifyToken(token);
            expect(result).not.toBeNull();
            expect(result?.sub).toBe('user-123');
            expect(result?.email).toBe('test@example.com');
            expect(result?.role).toBe('user');
            expect(result?.iat).toBeDefined();
            expect(result?.exp).toBeDefined();
        });
        it('should return null for refresh token when verifying as access token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const refreshToken = await jwtService.createRefreshToken(payload);
            const result = await jwtService.verifyToken(refreshToken);
            expect(result).toBeNull();
        });
    });
    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const token = await jwtService.createRefreshToken(payload);
            const result = await jwtService.verifyRefreshToken(token);
            expect(result).not.toBeNull();
            expect(result?.sub).toBe('user-123');
            expect(result?.email).toBe('test@example.com');
            expect(result?.role).toBe('user');
        });
        it('should return null for access token when verifying as refresh token', async () => {
            const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
            const accessToken = await jwtService.createToken(payload);
            const result = await jwtService.verifyRefreshToken(accessToken);
            expect(result).toBeNull();
        });
    });
    describe('token roundtrip', () => {
        it('should create and verify access token with full payload preserved', async () => {
            const originalPayload = { sub: 'user-456', email: 'admin@example.com', role: 'admin' };
            const token = await jwtService.createToken(originalPayload);
            const verified = await jwtService.verifyToken(token);
            expect(verified?.sub).toBe(originalPayload.sub);
            expect(verified?.email).toBe(originalPayload.email);
            expect(verified?.role).toBe(originalPayload.role);
        });
        it('should create and verify refresh token with full payload preserved', async () => {
            const originalPayload = { sub: 'user-789', email: 'user@example.com', role: 'user' };
            const token = await jwtService.createRefreshToken(originalPayload);
            const verified = await jwtService.verifyRefreshToken(token);
            expect(verified?.sub).toBe(originalPayload.sub);
            expect(verified?.email).toBe(originalPayload.email);
            expect(verified?.role).toBe(originalPayload.role);
        });
    });
});
