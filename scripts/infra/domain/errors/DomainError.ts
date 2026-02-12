/**
 * Domain Errors
 *
 * Base error classes for domain-level errors.
 * These are pure domain errors, independent of infrastructure.
 */

/**
 * Base class for all domain errors.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a value object receives invalid input.
 */
export abstract class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly invalidValue: unknown
  ) {
    super(message);
  }
}

/**
 * Error thrown when an invalid region is provided.
 */
export class InvalidRegionError extends ValidationError {
  readonly code = 'INVALID_REGION';

  constructor(value: string) {
    super(
      `Invalid region: '${value}'. Valid regions are: ap-northeast-1, us-east-1, us-west-2`,
      'region',
      value
    );
  }
}

/**
 * Error thrown when an invalid overlay is provided.
 */
export class InvalidOverlayError extends ValidationError {
  readonly code = 'INVALID_OVERLAY';

  constructor(value: string) {
    super(
      `Invalid overlay: '${value}'. Valid overlays are: local, staging, prod`,
      'overlay',
      value
    );
  }
}

/**
 * Error thrown when a required resource is not found.
 */
export abstract class NotFoundError extends DomainError {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly resourceId: string
  ) {
    super(message);
  }
}

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends DomainError {
  readonly code = 'TIMEOUT';

  constructor(
    operation: string,
    public readonly timeoutMs: number
  ) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
  }
}

/**
 * Error thrown when a resource is in an unexpected state.
 */
export class InvalidStateError extends DomainError {
  readonly code = 'INVALID_STATE';

  constructor(
    public readonly resourceType: string,
    public readonly expectedState: string,
    public readonly actualState: string
  ) {
    super(
      `${resourceType} is in state '${actualState}', expected '${expectedState}'`
    );
  }
}
