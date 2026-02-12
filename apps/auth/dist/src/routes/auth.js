import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { resolve } from '../container/index.js';
import { extractToken } from '../utils/token.js';
const auth = new Hono();
const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});
const refreshSchema = z.object({
    refresh_token: z.string().min(1, 'Refresh token is required'),
});
auth.post('/login', async (c) => {
    const authUseCase = resolve('authUseCase');
    const auditLogger = resolve('auditLogger');
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ success: false, message: 'Invalid JSON body' }, 400);
    }
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
        return c.json({
            success: false,
            message: 'Validation failed',
            errors: validation.error.flatten().fieldErrors,
        }, 400);
    }
    const result = await authUseCase.login(validation.data);
    if (result.success && result.accessToken) {
        // Verify token to get user info for audit log
        const verifyResult = await authUseCase.verify(result.accessToken);
        if (verifyResult.success && verifyResult.payload) {
            auditLogger.loginSuccess(c, verifyResult.payload.sub, verifyResult.payload.email, verifyResult.payload.role);
        }
        setCookie(c, 'session', result.accessToken, {
            httpOnly: true,
            path: '/',
            maxAge: authUseCase.accessTokenTTL,
        });
        return c.json({
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
            token_type: 'Bearer',
            expires_in: result.expiresIn,
        });
    }
    auditLogger.loginFailure(c, validation.data.username, result.message);
    return c.json({ success: false, message: result.message }, 401);
});
auth.get('/me', async (c) => {
    const authUseCase = resolve('authUseCase');
    const token = extractToken(c);
    if (!token) {
        return c.json({ authenticated: false });
    }
    const result = await authUseCase.verify(token);
    if (!result.success || !result.payload) {
        return c.json({ authenticated: false });
    }
    return c.json({
        authenticated: true,
        user: {
            sub: result.payload.sub,
            email: result.payload.email,
            role: result.payload.role,
        },
    });
});
auth.post('/refresh', async (c) => {
    const authUseCase = resolve('authUseCase');
    const auditLogger = resolve('auditLogger');
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ success: false, message: 'Invalid JSON body' }, 400);
    }
    const validation = refreshSchema.safeParse(body);
    if (!validation.success) {
        return c.json({
            success: false,
            message: 'Validation failed',
            errors: validation.error.flatten().fieldErrors,
        }, 400);
    }
    const result = await authUseCase.refresh(validation.data.refresh_token);
    if (result.success && result.accessToken) {
        // Verify new token to get user info for audit log
        const verifyResult = await authUseCase.verify(result.accessToken);
        auditLogger.tokenRefresh(c, true, verifyResult.payload?.sub);
        setCookie(c, 'session', result.accessToken, {
            httpOnly: true,
            path: '/',
            maxAge: authUseCase.accessTokenTTL,
        });
        return c.json({
            access_token: result.accessToken,
            token_type: 'Bearer',
            expires_in: result.expiresIn,
        });
    }
    auditLogger.tokenRefresh(c, false);
    return c.json({ success: false, message: result.message }, 401);
});
auth.post('/logout', async (c) => {
    const authUseCase = resolve('authUseCase');
    const auditLogger = resolve('auditLogger');
    const token = extractToken(c);
    let userId;
    let email;
    if (token) {
        // Get user info before logout for audit
        const verifyResult = await authUseCase.verify(token);
        if (verifyResult.payload) {
            userId = verifyResult.payload.sub;
            email = verifyResult.payload.email;
        }
        await authUseCase.logout(token);
    }
    auditLogger.logout(c, userId, email);
    deleteCookie(c, 'session', {
        httpOnly: true,
        path: '/',
    });
    return c.json({ message: 'logged out' });
});
export { auth };
