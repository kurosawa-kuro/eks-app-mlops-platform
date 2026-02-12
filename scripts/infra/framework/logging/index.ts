/**
 * Logging module exports
 */

// Console logging (human-readable)
export { colors, c } from './colors.js';
export { log } from './logger.js';
export { FileLogger } from './FileLogger.js';
export type { FileLoggerConfig } from './FileLogger.js';

// Structured logging (JSON/Pino)
export {
  StructuredLogger,
  createStructuredLogger,
  structuredLog,
} from './structured.js';
export type {
  LogLevel,
  LogContext,
  StructuredLoggerConfig,
} from './structured.js';
