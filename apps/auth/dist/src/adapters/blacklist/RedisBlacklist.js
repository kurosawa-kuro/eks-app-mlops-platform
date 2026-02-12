import { Redis } from 'ioredis';
/**
 * Redis-based token blacklist for distributed systems
 *
 * Suitable for multi-instance K8s deployments where
 * token invalidation must be shared across all instances.
 *
 * Uses Redis SETEX for automatic expiration.
 */
export class RedisBlacklist {
    redisUrl;
    logger;
    redis;
    keyPrefix = 'token:blacklist:';
    constructor(redisUrl, logger) {
        this.redisUrl = redisUrl;
        this.logger = logger;
        this.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    this.logger.error('Redis connection failed after 3 retries');
                    return null; // Stop retrying
                }
                return Math.min(times * 100, 3000); // Exponential backoff
            },
        });
        this.redis.on('connect', () => {
            this.logger.info('Redis connected for token blacklist');
        });
        this.redis.on('error', (err) => {
            this.logger.error({ error: err.message }, 'Redis connection error');
        });
        this.logger.debug('RedisBlacklist initialized');
    }
    /**
     * Add a token to the blacklist with automatic expiration
     */
    async add(token, expiresAt) {
        const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        if (ttlSeconds <= 0) {
            // Token already expired, no need to blacklist
            return;
        }
        const key = this.keyPrefix + this.hashToken(token);
        await this.redis.setex(key, ttlSeconds, '1');
        this.logger.debug({ tokenPrefix: token.substring(0, 20), ttlSeconds }, 'Token added to Redis blacklist');
    }
    /**
     * Check if a token is blacklisted
     */
    async isBlacklisted(token) {
        const key = this.keyPrefix + this.hashToken(token);
        const result = await this.redis.exists(key);
        return result === 1;
    }
    /**
     * Hash token for storage (avoid storing full JWT in Redis)
     */
    hashToken(token) {
        // Use simple hash for key (token signature is unique enough)
        // In production, consider using crypto.createHash('sha256')
        const signature = token.split('.')[2] || token;
        return signature.substring(0, 32);
    }
    /**
     * Health check for Redis connection
     */
    async ping() {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        }
        catch {
            return false;
        }
    }
    /**
     * Graceful shutdown
     */
    async destroy() {
        await this.redis.quit();
        this.logger.debug('RedisBlacklist destroyed');
    }
}
