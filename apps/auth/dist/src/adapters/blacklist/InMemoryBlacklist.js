/**
 * In-memory token blacklist for invalidated tokens
 * Periodically cleans up expired entries
 *
 * Note: Not suitable for distributed systems (multi-instance).
 * Consider using RedisBlacklist for production K8s deployments.
 */
export class InMemoryBlacklist {
    logger;
    blacklist = new Map();
    cleanupInterval = null;
    constructor(logger) {
        this.logger = logger;
        // Start periodic cleanup (every 5 minutes)
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        this.logger.debug('InMemoryBlacklist initialized');
    }
    /**
     * Add a token to the blacklist
     */
    async add(token, expiresAt) {
        this.blacklist.set(token, { expiresAt });
        this.logger.debug({ tokenPrefix: token.substring(0, 20) }, 'Token added to blacklist');
    }
    /**
     * Check if a token is blacklisted
     */
    async isBlacklisted(token) {
        const entry = this.blacklist.get(token);
        if (!entry) {
            return false;
        }
        // Check if entry has expired
        if (entry.expiresAt < new Date()) {
            this.blacklist.delete(token);
            return false;
        }
        return true;
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = new Date();
        let cleaned = 0;
        for (const [token, entry] of this.blacklist) {
            if (entry.expiresAt < now) {
                this.blacklist.delete(token);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.logger.debug({ cleaned }, 'Cleaned up expired blacklist entries');
        }
    }
    /**
     * Stop the cleanup interval (for graceful shutdown)
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.logger.debug('InMemoryBlacklist destroyed');
        }
    }
}
