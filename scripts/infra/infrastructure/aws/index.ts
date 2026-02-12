/**
 * AWS Infrastructure exports
 *
 * Structure:
 * - api/        : stateless query functions (describe, list, get)
 * - operations/ : complex operations (cleanup, upload, diagnostics)
 * - runtime/    : command execution (SSM)
 */

// API - stateless query functions
export * from './api/index.js';

// Operations - complex stateful operations
export * from './operations/index.js';

// Runtime - command execution
export * from './runtime/index.js';
