/**
 * Domain Layer - Pure business logic
 *
 * This layer contains:
 * - Value Objects: Immutable domain primitives (Region, Overlay, Phase)
 * - Entities: Domain objects with identity (EksCluster, NodeGroup, DatabaseCluster)
 * - Errors: Domain-specific error types
 *
 * The domain layer has NO dependencies on infrastructure or framework.
 */

// Value Objects
export * from './valueObjects/index.js';

// Cluster Domain
export * from './cluster/index.js';

// Database Domain
export * from './database/index.js';

// Domain Errors
export * from './errors/index.js';
