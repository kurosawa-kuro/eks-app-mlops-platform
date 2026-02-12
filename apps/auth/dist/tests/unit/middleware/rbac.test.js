import { describe, it, expect } from '@jest/globals';
import { hasPermission, hasAnyPermission, hasAllPermissions, } from '../../../src/middleware/rbac.js';
describe('RBAC Middleware', () => {
    describe('hasPermission', () => {
        it('should return true for admin with admin:all permission', () => {
            expect(hasPermission('admin', 'read:users')).toBe(true);
            expect(hasPermission('admin', 'write:users')).toBe(true);
            expect(hasPermission('admin', 'delete:users')).toBe(true);
            expect(hasPermission('admin', 'read:analytics')).toBe(true);
            expect(hasPermission('admin', 'write:analytics')).toBe(true);
        });
        it('should return true for user with allowed permissions', () => {
            expect(hasPermission('user', 'read:users')).toBe(true);
            expect(hasPermission('user', 'read:analytics')).toBe(true);
        });
        it('should return false for user with restricted permissions', () => {
            expect(hasPermission('user', 'write:users')).toBe(false);
            expect(hasPermission('user', 'delete:users')).toBe(false);
            expect(hasPermission('user', 'write:analytics')).toBe(false);
            expect(hasPermission('user', 'admin:all')).toBe(false);
        });
        it('should return false for guest with any permission', () => {
            expect(hasPermission('guest', 'read:users')).toBe(false);
            expect(hasPermission('guest', 'read:analytics')).toBe(false);
            expect(hasPermission('guest', 'admin:all')).toBe(false);
        });
    });
    describe('hasAnyPermission', () => {
        it('should return true if user has any of the permissions', () => {
            expect(hasAnyPermission('user', ['read:users', 'write:users'])).toBe(true);
            expect(hasAnyPermission('user', ['write:users', 'read:analytics'])).toBe(true);
        });
        it('should return false if user has none of the permissions', () => {
            expect(hasAnyPermission('user', ['write:users', 'delete:users'])).toBe(false);
            expect(hasAnyPermission('guest', ['read:users', 'read:analytics'])).toBe(false);
        });
        it('should return true for admin with any permissions', () => {
            expect(hasAnyPermission('admin', ['delete:users'])).toBe(true);
            expect(hasAnyPermission('admin', ['admin:all'])).toBe(true);
        });
    });
    describe('hasAllPermissions', () => {
        it('should return true if user has all permissions', () => {
            expect(hasAllPermissions('user', ['read:users', 'read:analytics'])).toBe(true);
            expect(hasAllPermissions('admin', ['read:users', 'write:users', 'delete:users'])).toBe(true);
        });
        it('should return false if user is missing any permission', () => {
            expect(hasAllPermissions('user', ['read:users', 'write:users'])).toBe(false);
            expect(hasAllPermissions('user', ['read:users', 'delete:users'])).toBe(false);
        });
        it('should return false for guest with any permissions', () => {
            expect(hasAllPermissions('guest', ['read:users'])).toBe(false);
        });
        it('should return true for empty permission list', () => {
            expect(hasAllPermissions('user', [])).toBe(true);
            expect(hasAllPermissions('guest', [])).toBe(true);
        });
    });
});
