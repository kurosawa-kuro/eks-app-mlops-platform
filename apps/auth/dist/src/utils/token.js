import { getCookie } from 'hono/cookie';
/**
 * Extract bearer token from Authorization header or session cookie
 * Priority: Authorization header > Cookie
 */
export function extractToken(c) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return getCookie(c, 'session');
}
