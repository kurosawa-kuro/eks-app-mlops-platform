import { ROLE_PERMISSIONS } from '../domain/types/auth.js';
/**
 * Check if a role has a specific permission
 */
export function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes('admin:all') || permissions.includes(permission);
}
/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role, permissions) {
    return permissions.some((permission) => hasPermission(role, permission));
}
/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role, permissions) {
    return permissions.every((permission) => hasPermission(role, permission));
}
/**
 * Middleware to require specific roles
 *
 * @example
 * // Require admin role
 * app.get('/admin', requireRole('admin'), handler)
 *
 * // Require admin or user role
 * app.get('/dashboard', requireRole(['admin', 'user']), handler)
 */
export function requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return c.json({
                error: 'Unauthorized',
                message: 'Authentication required',
            }, 401);
        }
        if (!allowedRoles.includes(user.role)) {
            return c.json({
                error: 'Forbidden',
                message: `Required role: ${allowedRoles.join(' or ')}`,
            }, 403);
        }
        await next();
    };
}
/**
 * Middleware to require specific permissions
 *
 * @example
 * // Require single permission
 * app.get('/users', requirePermission('read:users'), handler)
 *
 * // Require any of multiple permissions
 * app.post('/users', requirePermission(['write:users', 'admin:all']), handler)
 */
export function requirePermission(permissions) {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return c.json({
                error: 'Unauthorized',
                message: 'Authentication required',
            }, 401);
        }
        if (!hasAnyPermission(user.role, requiredPermissions)) {
            return c.json({
                error: 'Forbidden',
                message: `Required permission: ${requiredPermissions.join(' or ')}`,
            }, 403);
        }
        await next();
    };
}
/**
 * Middleware to require all specified permissions
 *
 * @example
 * // Require both read and write permissions
 * app.put('/users/:id', requireAllPermissions(['read:users', 'write:users']), handler)
 */
export function requireAllPermissions(permissions) {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return c.json({
                error: 'Unauthorized',
                message: 'Authentication required',
            }, 401);
        }
        if (!hasAllPermissions(user.role, permissions)) {
            return c.json({
                error: 'Forbidden',
                message: `Required permissions: ${permissions.join(' and ')}`,
            }, 403);
        }
        await next();
    };
}
