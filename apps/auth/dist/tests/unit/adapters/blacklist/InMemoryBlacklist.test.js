import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InMemoryBlacklist } from '../../../../src/adapters/blacklist/InMemoryBlacklist.js';
// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
describe('InMemoryBlacklist', () => {
    let blacklist;
    beforeEach(() => {
        jest.clearAllMocks();
        blacklist = new InMemoryBlacklist(mockLogger);
    });
    afterEach(() => {
        // Clean up to prevent timer leaks
        blacklist.destroy();
    });
    describe('add', () => {
        it('should add a token to the blacklist', async () => {
            const token = 'test-token-123';
            const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
            await blacklist.add(token, expiresAt);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ tokenPrefix: token.substring(0, 20) }), 'Token added to blacklist');
        });
    });
    describe('isBlacklisted', () => {
        it('should return true for blacklisted token', async () => {
            const token = 'blacklisted-token';
            const expiresAt = new Date(Date.now() + 3600 * 1000);
            await blacklist.add(token, expiresAt);
            const result = await blacklist.isBlacklisted(token);
            expect(result).toBe(true);
        });
        it('should return false for non-blacklisted token', async () => {
            const result = await blacklist.isBlacklisted('unknown-token');
            expect(result).toBe(false);
        });
        it('should return false for expired blacklist entry', async () => {
            const token = 'expired-token';
            const expiresAt = new Date(Date.now() - 1000); // Already expired
            await blacklist.add(token, expiresAt);
            const result = await blacklist.isBlacklisted(token);
            expect(result).toBe(false);
        });
    });
    describe('multiple tokens', () => {
        it('should handle multiple tokens independently', async () => {
            const token1 = 'token-1';
            const token2 = 'token-2';
            const expiresAt = new Date(Date.now() + 3600 * 1000);
            await blacklist.add(token1, expiresAt);
            expect(await blacklist.isBlacklisted(token1)).toBe(true);
            expect(await blacklist.isBlacklisted(token2)).toBe(false);
        });
    });
    describe('destroy', () => {
        it('should stop cleanup interval', () => {
            blacklist.destroy();
            expect(mockLogger.debug).toHaveBeenCalledWith('InMemoryBlacklist destroyed');
        });
        it('should be safe to call destroy multiple times', () => {
            blacklist.destroy();
            blacklist.destroy();
            // Should not throw
            expect(true).toBe(true);
        });
    });
});
