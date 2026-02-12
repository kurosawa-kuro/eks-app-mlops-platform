/**
 * InfraError - Structured error class for infrastructure operations.
 */

import type { InfraErrorContext } from '../types.js';

/**
 * Structured error class for infrastructure operations.
 * Provides context information for debugging AWS/K8s issues.
 *
 * @example
 * throw new InfraError('Failed to describe cluster', {
 *   region: 'ap-northeast-1',
 *   cluster: 'my-cluster',
 *   operation: 'eks:DescribeCluster',
 *   awsErrorCode: 'ResourceNotFoundException',
 * });
 */
export class InfraError extends Error {
  readonly context: InfraErrorContext;

  constructor(message: string, context: InfraErrorContext = {}) {
    super(message);
    this.name = 'InfraError';
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InfraError);
    }
  }

  /**
   * Create InfraError from an unknown error (e.g., catch block).
   */
  static from(error: unknown, context: InfraErrorContext = {}): InfraError {
    if (error instanceof InfraError) {
      // Merge contexts, new context takes precedence
      return new InfraError(error.message, { ...error.context, ...context });
    }
    if (error instanceof Error) {
      return new InfraError(error.message, context);
    }
    return new InfraError(String(error), context);
  }

  /**
   * Create InfraError from AWS CLI error output.
   * Attempts to parse AWS error code and message from stderr.
   */
  static fromAwsError(message: string, stderr: string, context: InfraErrorContext = {}): InfraError {
    // Try to extract AWS error code (e.g., "ResourceNotFoundException")
    const codeMatch = stderr.match(/\(([A-Za-z]+Exception|[A-Za-z]+Error)\)/);
    const awsErrorCode = codeMatch ? codeMatch[1] : undefined;

    // Try to extract AWS error message
    const msgMatch = stderr.match(/An error occurred \([^)]+\)[^:]*: (.+)/);
    const awsErrorMessage = msgMatch ? msgMatch[1] : stderr.split('\n')[0];

    return new InfraError(message, {
      ...context,
      awsErrorCode,
      awsErrorMessage,
    });
  }

  /**
   * Format error for logging with context.
   */
  format(): string {
    const lines = [this.message];

    if (Object.keys(this.context).length > 0) {
      lines.push('Context:');
      for (const [key, value] of Object.entries(this.context)) {
        if (value !== undefined) {
          lines.push(`  ${key}: ${value}`);
        }
      }
    }

    return lines.join('\n');
  }
}
