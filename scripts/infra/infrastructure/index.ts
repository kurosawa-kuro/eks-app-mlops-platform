/**
 * Infrastructure Layer - Technical implementation details
 *
 * This layer contains all external system integrations:
 * - AWS: CLI wrappers, SSM, S3
 * - Kubernetes: kubectl, helm, manifests
 * - Terraform: output parsing
 * - Shell: command execution
 */

// AWS
export * from './aws/index.js';

// Kubernetes
export * from './kubernetes/index.js';

// Terraform
export * from './terraform/index.js';

// Shell
export * from './shell/index.js';

// Types - External boundary types
export * from './types.js';
