import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createAuditLogger } from '../../../src/middleware/auditLog.js';
// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Mock Hono context - use any to avoid type complexity
function createMockContext(overrides = {}) {
    return {
        req: {
            path: overrides.path || '/auth/login',
            method: overrides.method || 'POST',
            header: (name) => {
                const headers = {
                    'x-forwarded-for': '192.168.1.100',
                    'user-agent': 'Mozilla/5.0 Test Browser',
                    ...overrides.headers,
                };
                return headers[name.toLowerCase()];
            },
        },
    };
}
describe('Audit Logger', () => {
    let auditLogger;
    beforeEach(() => {
        jest.clearAllMocks();
        auditLogger = createAuditLogger(mockLogger);
    });
    describe('loginSuccess', () => {
        it('should log successful login with user details', () => {
            const ctx = createMockContext();
            auditLogger.loginSuccess(ctx, 'user-123', 'test@example.com', 'admin');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.login.success',
                userId: 'user-123',
                email: 'test@example.com',
                role: 'admin',
                ip: '192.168.1.100',
                path: '/auth/login',
                method: 'POST',
            }), 'Audit: Login successful');
        });
    });
    describe('loginFailure', () => {
        it('should log failed login attempt with reason', () => {
            const ctx = createMockContext();
            auditLogger.loginFailure(ctx, 'baduser', 'Invalid credentials');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.login.failure',
                ip: '192.168.1.100',
                details: { username: 'baduser', reason: 'Invalid credentials' },
            }), 'Audit: Login failed');
        });
    });
    describe('logout', () => {
        it('should log logout event', () => {
            const ctx = createMockContext({ path: '/auth/logout' });
            auditLogger.logout(ctx, 'user-123', 'test@example.com');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.logout',
                userId: 'user-123',
                email: 'test@example.com',
            }), 'Audit: Logout');
        });
        it('should log logout without user info if not authenticated', () => {
            const ctx = createMockContext({ path: '/auth/logout' });
            auditLogger.logout(ctx);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.logout',
                userId: undefined,
                email: undefined,
            }), 'Audit: Logout');
        });
    });
    describe('tokenVerify', () => {
        it('should log successful token verification', () => {
            const ctx = createMockContext({ path: '/auth/me', method: 'GET' });
            auditLogger.tokenVerify(ctx, true, 'user-123');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.token.verify',
                userId: 'user-123',
                details: { success: true },
            }), 'Audit: Token verified');
        });
        it('should log failed token verification', () => {
            const ctx = createMockContext({ path: '/auth/me', method: 'GET' });
            auditLogger.tokenVerify(ctx, false);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.token.verify',
                details: { success: false },
            }), 'Audit: Token verification failed');
        });
    });
    describe('tokenRefresh', () => {
        it('should log successful token refresh', () => {
            const ctx = createMockContext({ path: '/auth/refresh' });
            auditLogger.tokenRefresh(ctx, true, 'user-123');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.token.refresh',
                userId: 'user-123',
                details: { success: true },
            }), 'Audit: Token refreshed');
        });
        it('should log failed token refresh', () => {
            const ctx = createMockContext({ path: '/auth/refresh' });
            auditLogger.tokenRefresh(ctx, false);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.token.refresh',
                details: { success: false },
            }), 'Audit: Token refresh failed');
        });
    });
    describe('accessDenied', () => {
        it('should log access denied event', () => {
            const ctx = createMockContext({ path: '/admin/users', method: 'GET' });
            auditLogger.accessDenied(ctx, 'user-123', 'admin');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.access.denied',
                userId: 'user-123',
                details: { requiredRole: 'admin' },
            }), 'Audit: Access denied');
        });
    });
    describe('accessGranted', () => {
        it('should log access granted event', () => {
            const ctx = createMockContext({ path: '/admin/users', method: 'GET' });
            auditLogger.accessGranted(ctx, 'user-123', 'admin');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({
                event: 'auth.access.granted',
                userId: 'user-123',
                role: 'admin',
            }), 'Audit: Access granted');
        });
    });
    describe('IP extraction', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const ctx = createMockContext({
                headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' },
            });
            auditLogger.loginSuccess(ctx, 'user-123', 'test@example.com', 'user');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                ip: '10.0.0.1',
            }), expect.any(String));
        });
        it('should extract IP from x-real-ip header if x-forwarded-for is not present', () => {
            const ctx = {
                req: {
                    path: '/auth/login',
                    method: 'POST',
                    header: (name) => {
                        if (name.toLowerCase() === 'x-real-ip')
                            return '172.16.0.1';
                        if (name.toLowerCase() === 'user-agent')
                            return 'Test';
                        return undefined;
                    },
                },
            };
            auditLogger.loginSuccess(ctx, 'user-123', 'test@example.com', 'user');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
                ip: '172.16.0.1',
            }), expect.any(String));
        });
    });
});
