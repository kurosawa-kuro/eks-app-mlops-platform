/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS = {
    admin: ['admin:all', 'read:users', 'write:users', 'delete:users', 'read:analytics', 'write:analytics'],
    'admin-read-only': ['read:users', 'read:analytics'],
    user: ['read:users', 'read:analytics'],
    guest: [],
};
