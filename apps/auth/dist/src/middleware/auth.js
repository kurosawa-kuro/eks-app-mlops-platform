import { extractToken } from '../utils/token.js';
/**
 * Create authentication middleware that verifies tokens and sets user context
 * Does NOT block unauthenticated requests - routes decide how to handle
 */
export function createAuthMiddleware(authAdapter) {
    return async (c, next) => {
        const token = extractToken(c);
        if (token) {
            const result = await authAdapter.verify(token);
            if (result.success && result.payload) {
                c.set('user', result.payload);
                c.set('token', token);
            }
        }
        await next();
    };
}
/**
 * Require authentication - returns 401 if not authenticated
 * Use after createAuthMiddleware
 */
export function requireAuth() {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        await next();
    };
}
