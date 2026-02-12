import { BaseAuthAdapter } from './BaseAuthAdapter.js';
const DUMMY_USERS = [
    { id: 'dummy-admin-id', username: 'admin', password: 'password', email: 'admin@example.com', role: 'admin' },
    { id: 'dummy-user-id', username: 'user', password: 'password', email: 'user@example.com', role: 'user' },
    { id: 'dummy-viewer-id', username: 'viewer', password: 'password', email: 'viewer@example.com', role: 'guest' },
];
/**
 * Dummy authentication adapter for development/testing
 * Uses hardcoded users and local JWT generation
 */
export class DummyAuthAdapter extends BaseAuthAdapter {
    tokenBlacklist;
    jwtService;
    env;
    constructor(tokenBlacklist, jwtService, env, logger) {
        super(logger);
        this.tokenBlacklist = tokenBlacklist;
        this.jwtService = jwtService;
        this.env = env;
        this.logger.info('DummyAuthAdapter initialized');
    }
    async login(credentials) {
        const user = DUMMY_USERS.find((u) => u.username === credentials.username && u.password === credentials.password);
        if (!user) {
            return this.failureResult('Invalid credentials');
        }
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = await this.jwtService.createToken(payload);
        const refreshToken = await this.jwtService.createRefreshToken(payload);
        this.logger.info({ userId: user.id, email: user.email }, 'User logged in via Dummy');
        return this.successResult({ id: user.id, email: user.email }, { accessToken, refreshToken, expiresIn: this.env.ACCESS_TOKEN_TTL });
    }
    async verify(token) {
        if (await this.tokenBlacklist.isBlacklisted(token)) {
            return { success: false, message: 'Token has been revoked' };
        }
        const payload = await this.jwtService.verifyToken(token);
        if (!payload) {
            return { success: false, message: 'Invalid or expired token' };
        }
        return { success: true, payload };
    }
    async refresh(refreshToken) {
        const payload = await this.jwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            return { success: false, message: 'Invalid or expired refresh token' };
        }
        const { sub, email, role } = payload;
        const accessToken = await this.jwtService.createToken({ sub, email, role });
        return {
            success: true,
            accessToken,
            expiresIn: this.env.ACCESS_TOKEN_TTL,
        };
    }
    async logout(accessToken) {
        const expiresAt = new Date(Date.now() + this.env.ACCESS_TOKEN_TTL * 1000);
        await this.tokenBlacklist.add(accessToken, expiresAt);
        this.logger.info('User logged out via Dummy');
        return { success: true };
    }
}
