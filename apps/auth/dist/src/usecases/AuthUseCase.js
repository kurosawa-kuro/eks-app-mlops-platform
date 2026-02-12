/**
 * AuthUseCase - Business logic for authentication operations
 *
 * Separates business logic from HTTP concerns (routes).
 * Pure operations that can be tested independently.
 */
export class AuthUseCase {
    authAdapter;
    env;
    logger;
    constructor(authAdapter, env, logger) {
        this.authAdapter = authAdapter;
        this.env = env;
        this.logger = logger;
        this.logger.debug('AuthUseCase initialized');
    }
    /**
     * Authenticate user with credentials
     */
    async login(credentials) {
        this.logger.debug({ username: credentials.username }, 'Login attempt');
        const result = await this.authAdapter.login(credentials);
        if (result.success && result.accessToken) {
            return {
                success: true,
                message: 'Login successful',
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn,
            };
        }
        return {
            success: false,
            message: result.message || 'Authentication failed',
        };
    }
    /**
     * Verify an access token
     */
    async verify(token) {
        const result = await this.authAdapter.verify(token);
        if (result.success && result.payload) {
            return {
                success: true,
                payload: result.payload,
            };
        }
        return { success: false };
    }
    /**
     * Refresh access token using refresh token
     */
    async refresh(refreshToken) {
        this.logger.debug('Token refresh attempt');
        const result = await this.authAdapter.refresh(refreshToken);
        if (result.success && result.accessToken) {
            return {
                success: true,
                accessToken: result.accessToken,
                expiresIn: result.expiresIn,
            };
        }
        return {
            success: false,
            message: result.message || 'Token refresh failed',
        };
    }
    /**
     * Logout and invalidate token
     */
    async logout(token) {
        this.logger.debug('Logout attempt');
        await this.authAdapter.logout(token);
    }
    /**
     * Get access token TTL from config
     */
    get accessTokenTTL() {
        return this.env.ACCESS_TOKEN_TTL;
    }
}
