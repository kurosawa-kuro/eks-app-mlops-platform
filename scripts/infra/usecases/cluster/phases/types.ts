/**
 * Phase Types and Interfaces
 *
 * Defines the contract for executable phases in the provisioning workflow.
 */

import type { Logger } from '../../../framework/types.js';

/**
 * Result of a phase execution.
 */
export interface PhaseResult<T = void> {
  /** Whether the phase succeeded */
  success: boolean;
  /** Optional data returned by the phase */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
  /** Whether this phase was skipped */
  skipped?: boolean;
}

/**
 * Context passed to all phases.
 */
export interface PhaseContext {
  /** AWS region */
  region: string;
  /** Terraform directory */
  tfDir: string;
  /** Cluster name (once known) */
  clusterName?: string;
  /** Expected node count */
  expectedNodeCount?: number;
  /** Primary ASG name */
  primaryAsgName?: string;
  /** Bastion instance ID */
  bastionInstanceId?: string;
  /** Logger instance */
  log: Logger;
}

/**
 * Interface for executable phases.
 */
export interface ExecutablePhase<T = void> {
  /** Phase name */
  readonly name: string;
  /** Phase description */
  readonly description: string;
  /** Execute the phase */
  execute(context: PhaseContext): Promise<PhaseResult<T>>;
}

/**
 * Preflight check result.
 */
export interface PreflightResult {
  /** Whether all required checks passed */
  passed: boolean;
  /** Whether kubectl is available */
  hasKubectl: boolean;
  /** Whether terraform is initialized */
  tfInitialized: boolean;
}

/**
 * Terraform apply result.
 */
export interface TerraformResult {
  /** Cluster name */
  clusterName: string;
  /** Cluster endpoint */
  clusterEndpoint?: string;
  /** VPC ID */
  vpcId?: string;
  /** Bastion instance ID */
  bastionInstanceId?: string;
  /** Bastion connect command */
  bastionConnectCommand?: string;
  /** Cluster version */
  clusterVersion?: string;
}

/**
 * Node group result.
 */
export interface NodeGroupResult {
  /** Expected node count */
  expectedNodeCount: number;
  /** Primary ASG name */
  primaryAsgName?: string;
}

/**
 * ASG instance info.
 */
export interface ASGInstance {
  instanceId: string;
  state: string;
  zone: string;
}

/**
 * Kubernetes node info.
 */
export interface K8sNodeInfo {
  name?: string;
  ready: boolean;
  instanceType?: string;
  zone?: string;
}

/**
 * Smoke test result.
 */
export interface SmokeTestResult {
  passed: number;
  failed: number;
  warnings: number;
  exitCode: number;
}
