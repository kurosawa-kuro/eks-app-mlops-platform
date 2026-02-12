/**
 * Domain Errors exports
 */

// Base errors
export {
  DomainError,
  ValidationError,
  NotFoundError,
  InvalidRegionError,
  InvalidOverlayError,
  TimeoutError,
  InvalidStateError,
} from './DomainError.js';

// Cluster errors
export {
  ClusterNotFoundError,
  ClusterNotReadyError,
  NodeGroupNotFoundError,
  NodeGroupUnhealthyError,
  NoNodesAvailableError,
  BastionNotAccessibleError,
  ClusterProvisioningError,
} from './ClusterError.js';

// Database errors
export {
  DatabaseNotFoundError,
  DatabaseNotHealthyError,
  DatabaseInstancesNotReadyError,
  DatabaseCredentialsMissingError,
  DatabaseOperatorError,
  DatabaseBackupError,
  DatabaseConnectionError,
} from './DatabaseError.js';
