/**
 * Structured Logger with Pino
 *
 * Provides JSON-formatted structured logging for production use.
 * Falls back to pretty console output in development.
 *
 * Usage:
 *   import { structuredLog, createStructuredLogger } from './structured.js';
 *
 *   // Default instance (respects LOG_FORMAT env var)
 *   structuredLog.info({ event: 'deploy', cluster: 'prod' }, 'Deployment started');
 *
 *   // Custom instance
 *   const logger = createStructuredLogger({ name: 'eks-deploy', level: 'debug' });
 */

import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

/**
 * Log level type
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured log context
 */
export interface LogContext {
  /** Event name (e.g., 'cluster.provision', 'deploy.app') */
  event?: string;
  /** Phase name */
  phase?: string;
  /** Operation being performed */
  operation?: string;
  /** AWS region */
  region?: string;
  /** Cluster name */
  cluster?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error details */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Logger configuration
 */
export interface StructuredLoggerConfig {
  /** Logger name (appears in logs) */
  name?: string;
  /** Log level */
  level?: LogLevel;
  /** Force JSON output (ignores LOG_FORMAT) */
  forceJson?: boolean;
  /** Pretty print in development */
  pretty?: boolean;
}

/**
 * Structured Logger wrapper
 */
export class StructuredLogger {
  private pino: PinoLogger;
  private name: string;

  constructor(config: StructuredLoggerConfig = {}) {
    this.name = config.name || 'infra';

    const isProduction = process.env.NODE_ENV === 'production';
    const logFormat = process.env.LOG_FORMAT || (isProduction ? 'json' : 'pretty');
    const useJson = config.forceJson || logFormat === 'json';

    const options: LoggerOptions = {
      name: this.name,
      level: config.level || process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          host: bindings.hostname,
          name: bindings.name,
        }),
      },
    };

    if (useJson) {
      this.pino = pino(options);
    } else {
      // Pretty print for development
      this.pino = pino(
        options,
        pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
          },
        })
      );
    }
  }

  /**
   * Log at trace level
   */
  trace(context: LogContext, message: string): void {
    this.pino.trace(context, message);
  }

  /**
   * Log at debug level
   */
  debug(context: LogContext, message: string): void {
    this.pino.debug(context, message);
  }

  /**
   * Log at info level
   */
  info(context: LogContext, message: string): void {
    this.pino.info(context, message);
  }

  /**
   * Log at warn level
   */
  warn(context: LogContext, message: string): void {
    this.pino.warn(context, message);
  }

  /**
   * Log at error level
   */
  error(context: LogContext, message: string): void {
    this.pino.error(context, message);
  }

  /**
   * Log at fatal level
   */
  fatal(context: LogContext, message: string): void {
    this.pino.fatal(context, message);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): StructuredLogger {
    const child = new StructuredLogger({ name: this.name });
    child.pino = this.pino.child(context);
    return child;
  }

  /**
   * Log phase start
   */
  phaseStart(phase: string, operation: string, context: LogContext = {}): void {
    this.info(
      { ...context, event: 'phase.start', phase, operation },
      `Phase ${phase}: ${operation}`
    );
  }

  /**
   * Log phase completion
   */
  phaseComplete(phase: string, durationMs: number, context: LogContext = {}): void {
    this.info(
      { ...context, event: 'phase.complete', phase, durationMs },
      `Phase ${phase} completed in ${durationMs}ms`
    );
  }

  /**
   * Log phase failure
   */
  phaseFailed(phase: string, error: Error, context: LogContext = {}): void {
    this.error(
      {
        ...context,
        event: 'phase.failed',
        phase,
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
      `Phase ${phase} failed: ${error.message}`
    );
  }

  /**
   * Log deployment event
   */
  deploy(action: 'start' | 'complete' | 'failed', context: LogContext): void {
    const level = action === 'failed' ? 'error' : 'info';
    this.pino[level](
      { ...context, event: `deploy.${action}` },
      `Deployment ${action}`
    );
  }

  /**
   * Log AWS operation
   */
  aws(service: string, operation: string, context: LogContext = {}): void {
    this.debug(
      { ...context, event: 'aws.operation', service, operation },
      `AWS ${service}:${operation}`
    );
  }

  /**
   * Log Kubernetes operation
   */
  k8s(operation: string, resource: string, context: LogContext = {}): void {
    this.debug(
      { ...context, event: 'k8s.operation', operation, resource },
      `K8s ${operation} ${resource}`
    );
  }

  /**
   * Get underlying Pino logger
   */
  getPino(): PinoLogger {
    return this.pino;
  }
}

/**
 * Create a new structured logger
 */
export function createStructuredLogger(config: StructuredLoggerConfig = {}): StructuredLogger {
  return new StructuredLogger(config);
}

/**
 * Default structured logger instance
 */
export const structuredLog = createStructuredLogger();
