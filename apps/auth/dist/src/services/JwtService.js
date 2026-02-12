import * as jose from 'jose';
/**
 * JWT Service for token operations
 * Handles both access tokens (short-lived) and refresh tokens (long-lived)
 */
export class JwtService {
    env;
    logger;
    secret;
    constructor(env, logger) {
        this.env = env;
        this.logger = logger;
        this.secret = new TextEncoder().encode(env.JWT_SECRET);
    }
    /**
     * Create an access token (short-lived)
     */
    async createToken(payload) {
        const token = await new jose.SignJWT({ ...payload, type: 'access' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL}s`)
            .sign(this.secret);
        this.logger.debug({ sub: payload.sub }, 'Access token created');
        return token;
    }
    /**
     * Create a refresh token (long-lived)
     */
    async createRefreshToken(payload) {
        const token = await new jose.SignJWT({ ...payload, type: 'refresh' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(`${this.env.REFRESH_TOKEN_TTL}s`)
            .sign(this.secret);
        this.logger.debug({ sub: payload.sub }, 'Refresh token created');
        return token;
    }
    /**
     * Verify an access token
     */
    async verifyToken(token) {
        return this.verifyTokenInternal(token, 'access');
    }
    /**
     * Verify a refresh token
     */
    async verifyRefreshToken(token) {
        return this.verifyTokenInternal(token, 'refresh');
    }
    /**
     * Internal token verification with type checking
     */
    async verifyTokenInternal(token, expectedType) {
        try {
            const { payload } = await jose.jwtVerify(token, this.secret);
            if (payload.type !== expectedType) {
                this.logger.debug({ expected: expectedType, actual: payload.type }, 'Token type mismatch');
                return null;
            }
            return {
                sub: payload.sub,
                email: payload.email,
                role: payload.role || 'user',
                iat: payload.iat,
                exp: payload.exp,
            };
        }
        catch (error) {
            this.logger.debug({ error, type: expectedType }, 'Token verification failed');
            return null;
        }
    }
}
