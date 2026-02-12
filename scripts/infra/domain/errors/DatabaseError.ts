/**
 * Database Domain Errors
 *
 * Errors specific to database operations.
 */

import { DomainError, NotFoundError } from './DomainError.js';

/**
 * Error thrown when a database cluster is not found.
 */
export class DatabaseNotFoundError extends NotFoundError {
  readonly code = 'DATABASE_NOT_FOUND';

  constructor(databaseName: string) {
    super(`Database cluster not found: ${databaseName}`, 'DatabaseCluster', databaseName);
  }
}

/**
 * Error thrown when a database is not healthy.
 */
export class DatabaseNotHealthyError extends DomainError {
  readonly code = 'DATABASE_NOT_HEALTHY';

  constructor(
    public readonly databaseName: string,
    public readonly currentStatus: string
  ) {
    super(`Database '${databaseName}' is not healthy. Current status: ${currentStatus}`);
  }
}

/**
 * Error thrown when database instances are not ready.
 */
export class DatabaseInstancesNotReadyError extends DomainError {
  readonly code = 'DATABASE_INSTANCES_NOT_READY';

  constructor(
    public readonly databaseName: string,
    public readonly expectedCount: number,
    public readonly actualCount: number
  ) {
    super(
      `Database '${databaseName}' has ${actualCount} ready instances, expected ${expectedCount}`
    );
  }
}

/**
 * Error thrown when database credentials are missing.
 */
export class DatabaseCredentialsMissingError extends DomainError {
  readonly code = 'DATABASE_CREDENTIALS_MISSING';

  constructor(public readonly secretName: string) {
    super(`Database credentials not found in secret '${secretName}'`);
  }
}

/**
 * Error thrown when database operator installation fails.
 */
export class DatabaseOperatorError extends DomainError {
  readonly code = 'DATABASE_OPERATOR_ERROR';

  constructor(
    public readonly operatorName: string,
    public readonly details: string
  ) {
    super(`Database operator '${operatorName}' error: ${details}`);
  }
}

/**
 * Error thrown when database backup fails.
 */
export class DatabaseBackupError extends DomainError {
  readonly code = 'DATABASE_BACKUP_FAILED';

  constructor(
    public readonly databaseName: string,
    public readonly reason: string
  ) {
    super(`Database backup failed for '${databaseName}': ${reason}`);
  }
}

/**
 * Error thrown when database connection fails.
 */
export class DatabaseConnectionError extends DomainError {
  readonly code = 'DATABASE_CONNECTION_FAILED';

  constructor(
    public readonly databaseName: string,
    public readonly host: string,
    public readonly port: number
  ) {
    super(`Cannot connect to database '${databaseName}' at ${host}:${port}`);
  }
}
