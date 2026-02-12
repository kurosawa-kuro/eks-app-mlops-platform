/**
 * Deployment Phase Types and Interfaces
 *
 * Defines the contract for executable phases in the deployment workflow.
 */

import type { Logger } from '../../../framework/types.js';
import type { SSMCommandRunner } from '../../../infrastructure/aws/runtime/SSMCommandRunner.js';
import type { Overlay } from '../../../domain/valueObjects/Overlay.js';

/**
 * Result of a deployment phase execution.
 */
export interface DeploymentPhaseResult<T = void> {
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
 * Context passed to all deployment phases.
 */
export interface DeploymentPhaseContext {
  /** AWS region */
  region: string;
  /** EKS cluster name */
  clusterName: string;
  /** S3 bucket for manifests */
  bucket: string;
  /** Bastion instance ID */
  bastionInstanceId?: string;
  /** SSM runner for bastion execution */
  ssmRunner?: SSMCommandRunner;
  /** Deployment overlay */
  overlay: Overlay;
  /** Logger instance */
  log: Logger;
  /** kubectl version */
  kubectlVersion?: string;
}

/**
 * Interface for executable deployment phases.
 */
export interface ExecutableDeploymentPhase<T = void> {
  /** Phase name */
  readonly name: string;
  /** Phase description */
  readonly description: string;
  /** Execute the phase */
  execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<T>>;
}

/**
 * Preflight result for deployment commands.
 */
export interface DeploymentPreflightResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Bastion instance ID */
  bastionId?: string;
  /** ALB configuration (if requested) */
  albConfig?: {
    lbRoleArn: string;
    vpcId: string;
  };
}

/**
 * S3 upload result.
 */
export interface ManifestUploadResult {
  /** Uploaded manifest count */
  uploadedCount: number;
  /** S3 prefix used */
  s3Prefix: string;
}

/**
 * App deployment result.
 */
export interface AppDeployResult {
  /** Deployed components */
  components: string[];
  /** Whether dry-run mode was used */
  dryRun: boolean;
}

/**
 * MLOps deployment result.
 */
export interface MLOpsDeployResult {
  /** Whether base resources were deployed */
  baseDeployed: boolean;
  /** Job name if a job was run */
  jobName?: string;
  /** Whether job completed successfully */
  jobCompleted?: boolean;
}

/**
 * GPU deployment step.
 */
export type GPUStep = '1' | '2' | '3' | '4' | '5' | 'all' | 'status';

/**
 * GPU deployment result.
 */
export interface GPUDeployResult {
  /** Steps executed */
  steps: string[];
  /** Whether Karpenter was installed */
  karpenterInstalled: boolean;
  /** Whether LLM stack was deployed */
  llmDeployed: boolean;
}

/**
 * HTTPS verification result.
 */
export interface HTTPSVerifyResult {
  /** Whether verification passed */
  passed: boolean;
  /** URL verified */
  url: string;
  /** Response status code */
  statusCode?: number;
}

/**
 * MLOps job configuration.
 */
export interface MLOpsJobConfig {
  k8sName: string;
  fileName: string;
}

/**
 * App deployment input.
 */
export interface AppDeploymentInput {
  /** Overlay to use */
  overlay: Overlay;
  /** Component to deploy */
  component: 'all' | 'backend' | 'frontend';
  /** Skip S3 upload */
  skipUpload: boolean;
  /** Dry-run mode */
  dryRun: boolean;
  /** Setup ALB Controller */
  setupAlb: boolean;
  /** Skip HTTPS verification */
  skipHttps: boolean;
}

/**
 * MLOps deployment input.
 */
export interface MLOpsDeploymentInput {
  /** Skip S3 upload */
  skipUpload: boolean;
  /** Dry-run mode */
  dryRun: boolean;
  /** Job to run */
  job?: string | null;
  /** Skip base resources, only run job */
  deployOnly: boolean;
  /** Wait for job completion */
  waitJob: boolean;
}

/**
 * GPU deployment input.
 */
export interface GPUDeploymentInput {
  /** Step to execute */
  step: GPUStep;
}
