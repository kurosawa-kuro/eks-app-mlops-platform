/**
 * Framework Module - Cross-cutting infrastructure concerns
 *
 * Exports:
 * - Command: CLI command base classes
 * - Logging: Terminal output utilities
 * - Lifecycle: Polling, preflight checks, verification
 * - Errors: Structured error handling
 */

// Command - CLI base classes
export {
  InfraCommand,
  AwsCommand,
  CommandBuilder,
  lib,
} from './command/index.js';
export type {
  ParsedArgs,
  ResolvedCommand,
  ListPatternConfig,
  ShowPatternConfig,
  CreatePatternConfig,
} from './command/index.js';

// Logging - Terminal output
export { colors, c, log } from './logging/index.js';

// Lifecycle - Polling and verification
export {
  Poller,
  PreflightChecker,
  HTTPSVerifier,
} from './lifecycle/index.js';
export type { PollerDependencies } from './lifecycle/index.js';

// Errors - Error handling
export { InfraError, withRetry } from './errors/index.js';

// Narrative - CLI output formatting (起承転結)
export * from './narrative/index.js';

// Utils - General utilities
export * from './utils/index.js';

// Types - Internal framework types
export type * from './types.js';
