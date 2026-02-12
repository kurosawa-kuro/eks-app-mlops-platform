/**
 * Deployer Types
 *
 * Common interfaces for Kubernetes deployment operations.
 */

import type { SSMCommandRunner } from '../../aws/runtime/SSMCommandRunner.js';
import type { Logger } from '../../../framework/types.js';
import type { RunOptions } from '../../types.js';

/**
 * Dependencies for deployer classes.
 * Enables dependency injection for testing.
 *
 * @example
 * // Production (uses defaults)
 * const deployer = new ManifestDeployer(config);
 *
 * // Testing (inject mocks)
 * const deps = { run: vi.fn(), log: mockLogger };
 * const deployer = new ManifestDeployer(config, deps);
 */
export interface DeployerDependencies {
  /** Shell command executor */
  run: (cmd: string, options?: RunOptions) => string | null;
  /** Logger instance */
  log: Logger;
}

/**
 * Base configuration for all deployers.
 */
export interface DeployerConfig {
  /** Target namespace for deployments */
  namespace: string;
  /** SSM runner for bastion-based deployments (for private clusters) */
  bastionRunner?: SSMCommandRunner;
  /** If true, run in dry-run mode */
  dryRun?: boolean;
  /** If true, suppress output */
  silent?: boolean;
  /** AWS region */
  region?: string;
}

/**
 * Result of a deployment operation.
 */
export interface DeployResult {
  /** Whether the deployment succeeded */
  success: boolean;
  /** Output from the deployment command */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Resources affected */
  resources?: string[];
}

/**
 * Options for manifest deployment.
 */
export interface ManifestDeployOptions {
  /** Wait for resources to be ready */
  wait?: boolean;
  /** Timeout for wait in seconds */
  waitTimeout?: number;
  /** Label for logging */
  label?: string;
  /** Override namespace (uses config namespace by default) */
  namespace?: string;
}

/**
 * Options for Kustomize deployment.
 */
export interface KustomizeDeployOptions extends ManifestDeployOptions {
  /** Build only (don't apply) */
  buildOnly?: boolean;
}

/**
 * Options for rollout operations.
 */
export interface RolloutOptions {
  /** Resource type (e.g., 'deployment', 'statefulset') */
  resourceType: string;
  /** Resource name */
  name: string;
  /** Timeout in seconds */
  timeout?: number;
}

/**
 * Options for Helm installation.
 */
export interface HelmInstallOptions {
  /** Release name */
  releaseName: string;
  /** Chart name or path */
  chart: string;
  /** Chart version */
  version?: string;
  /** Helm repository name */
  repo?: string;
  /** Create namespace if not exists */
  createNamespace?: boolean;
  /** Helm values as object */
  values?: Record<string, unknown>;
  /** Path to values file */
  valuesFile?: string;
  /** Set individual values */
  set?: Record<string, string>;
  /** Wait for installation to complete */
  wait?: boolean;
  /** Wait timeout in seconds */
  timeout?: number;
}

/**
 * Options for Helm upgrade.
 */
export interface HelmUpgradeOptions extends HelmInstallOptions {
  /** Install if release doesn't exist */
  install?: boolean;
  /** Reset values to defaults */
  resetValues?: boolean;
  /** Reuse previous values */
  reuseValues?: boolean;
}
