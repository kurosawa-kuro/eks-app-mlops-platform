/**
 * Get client IP from request
 */
function getClientIp(c) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIp = c.req.header('x-real-ip');
    if (realIp) {
        return realIp;
    }
    return 'unknown';
}
/**
 * Create audit logger for authentication events
 */
export function createAuditLogger(logger) {
    return {
        /**
         * Log a successful login
         */
        loginSuccess(c, userId, email, role) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.login.success',
                userId,
                email,
                role,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
            };
            logger.info(entry, 'Audit: Login successful');
        },
        /**
         * Log a failed login attempt
         */
        loginFailure(c, username, reason) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.login.failure',
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
                details: { username, reason },
            };
            logger.warn(entry, 'Audit: Login failed');
        },
        /**
         * Log a logout event
         */
        logout(c, userId, email) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.logout',
                userId,
                email,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
            };
            logger.info(entry, 'Audit: Logout');
        },
        /**
         * Log token verification
         */
        tokenVerify(c, success, userId) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.token.verify',
                userId,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
                details: { success },
            };
            if (success) {
                logger.debug(entry, 'Audit: Token verified');
            }
            else {
                logger.debug(entry, 'Audit: Token verification failed');
            }
        },
        /**
         * Log token refresh
         */
        tokenRefresh(c, success, userId) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.token.refresh',
                userId,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
                details: { success },
            };
            if (success) {
                logger.info(entry, 'Audit: Token refreshed');
            }
            else {
                logger.warn(entry, 'Audit: Token refresh failed');
            }
        },
        /**
         * Log access denied (RBAC failure)
         */
        accessDenied(c, userId, requiredRole) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.access.denied',
                userId,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
                details: { requiredRole },
            };
            logger.warn(entry, 'Audit: Access denied');
        },
        /**
         * Log access granted
         */
        accessGranted(c, userId, role) {
            const entry = {
                timestamp: new Date().toISOString(),
                event: 'auth.access.granted',
                userId,
                role,
                ip: getClientIp(c),
                userAgent: c.req.header('user-agent') || 'unknown',
                path: c.req.path,
                method: c.req.method,
            };
            logger.debug(entry, 'Audit: Access granted');
        },
    };
}
/**
 * Middleware to automatically log authentication-related requests
 *
 * @example
 * app.use('/auth/*', auditLogMiddleware(logger))
 */
export function auditLogMiddleware(logger) {
    const audit = createAuditLogger(logger);
    return async (c, next) => {
        const startTime = Date.now();
        await next();
        const duration = Date.now() - startTime;
        const user = c.get('user');
        const path = c.req.path;
        const status = c.res.status;
        // Log based on path and status
        if (path.includes('/auth/login')) {
            if (status === 200) {
                // Login success is logged in the route handler with user details
            }
            else if (status === 401) {
                // Login failure - already logged in route
            }
        }
        else if (path.includes('/auth/logout')) {
            audit.logout(c, user?.sub, user?.email);
        }
        else if (path.includes('/auth/me')) {
            audit.tokenVerify(c, status === 200 && !!user, user?.sub);
        }
        else if (path.includes('/auth/refresh')) {
            audit.tokenRefresh(c, status === 200, user?.sub);
        }
        // Log general request metrics
        logger.debug({
            path,
            method: c.req.method,
            status,
            duration,
            userId: user?.sub,
        }, 'Request completed');
    };
}
