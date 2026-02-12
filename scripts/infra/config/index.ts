/**
 * Shared Configuration for Infrastructure Scripts
 *
 * Centralizes configuration values that are used across multiple scripts.
 * Values are loaded from:
 *   1. Environment variables (highest priority)
 *   2. Terraform outputs
 *   3. Defaults (lowest priority, with warnings)
 */

import { z } from 'zod';
import { log } from '../framework/logging/index.js';
import { awsGetRegion, awsGetAccountId } from '../infrastructure/aws/index.js';
import { createTerraformOutputs } from '../infrastructure/terraform/index.js';
import type { TerraformOutputs } from '../infrastructure/types.js';
import { PATHS } from './paths.js';

// ============================================================
// Zod Schemas for Config Validation
// ============================================================

/** AWS Region pattern (e.g., ap-northeast-1, us-east-1) */
const AwsRegionSchema = z.string().regex(
  /^[a-z]{2}-[a-z]+-\d+$/,
  'Invalid AWS region format (expected: xx-xxxx-N)'
);

/** AWS Account ID (12 digits) */
const AwsAccountIdSchema = z.string().regex(
  /^\d{12}$/,
  'Invalid AWS account ID (expected: 12 digits)'
).nullable();

/** EC2 Instance ID (i-xxxxxxxxxxxxxxxxx) */
const InstanceIdSchema = z.string().regex(
  /^i-[a-f0-9]{8,17}$/,
  'Invalid EC2 instance ID format'
).nullable();

/** ARN format */
const ArnSchema = z.string().regex(
  /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/,
  'Invalid ARN format'
).nullable();

/** S3 bucket name (3-63 chars, lowercase, no underscores) */
const S3BucketSchema = z.string().regex(
  /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
  'Invalid S3 bucket name'
).nullable();

/** VPC ID (vpc-xxxxxxxxx) */
const VpcIdSchema = z.string().regex(
  /^vpc-[a-f0-9]{8,17}$/,
  'Invalid VPC ID format'
).nullable();

/** ECR URL */
const EcrUrlSchema = z.string().regex(
  /^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/.+$/,
  'Invalid ECR URL format'
).nullable();

/** HTTPS URL */
const HttpsUrlSchema = z.string().url().startsWith('https://').nullable();

/** EKS cluster name (alphanumeric, hyphen, underscore) */
const ClusterNameSchema = z.string().regex(
  /^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/,
  'Invalid EKS cluster name'
).nullable();

/**
 * Full config schema for runtime validation.
 * All fields are optional/nullable since values come from multiple sources.
 */
export const ConfigSchema = z.object({
  region: AwsRegionSchema,
  accountId: AwsAccountIdSchema,
  clusterName: ClusterNameSchema,
  clusterEndpoint: HttpsUrlSchema,
  bastionInstanceId: InstanceIdSchema,
  s3Bucket: S3BucketSchema,
  workloadRoleArn: ArnSchema,
  lbControllerRoleArn: ArnSchema,
  karpenterRoleArn: ArnSchema,
  karpenterQueueName: z.string().nullable(),
  vpcId: VpcIdSchema,
  ecrMlopsUrl: EcrUrlSchema,
  apiUrl: HttpsUrlSchema,
  tfDir: z.string(),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;

// Default Terraform directory
export const DEFAULT_TF_DIR = PATHS.terraform.prod;

export interface Config {
  // AWS
  region: string;
  accountId: string | null;

  // EKS Cluster
  clusterName: string | null;
  clusterEndpoint: string | null;

  // Bastion
  bastionInstanceId: string | null;

  // S3
  s3Bucket: string | null;

  // IAM Roles
  workloadRoleArn: string | null;
  lbControllerRoleArn: string | null;
  karpenterRoleArn: string | null;

  // Karpenter
  karpenterQueueName: string | null;

  // VPC
  vpcId: string | null;

  // ECR
  ecrMlopsUrl: string | null;

  // API
  apiUrl: string | null;

  // Paths
  tfDir: string;

  // Raw terraform accessor
  tf: TerraformOutputs;

  // Validation helper - throws if key is missing
  require(key: keyof Config): string;

  // Check if all required values are present - throws if any missing
  validate(requiredKeys: Array<keyof Config>): boolean;

  // Strict validation using Zod schemas - validates format of all present values
  validateStrict(): { success: boolean; errors: string[] };
}

/**
 * Create configuration object with values from terraform outputs and environment
 */
export function createConfig(tfDir = DEFAULT_TF_DIR): Config {
  const tf = createTerraformOutputs(tfDir);

  // Helper to get value with fallback and optional warning
  const getValue = (
    envKey: string,
    tfKey: string,
    defaultValue: string | null = null,
    warnOnDefault = true
  ): string | null => {
    // 1. Environment variable
    if (process.env[envKey]) {
      return process.env[envKey] as string;
    }
    // 2. Terraform output
    const tfValue = tf.get(tfKey);
    if (tfValue) {
      return tfValue;
    }
    // 3. Default with warning
    if (warnOnDefault && defaultValue && process.env.NODE_ENV !== 'test') {
      log.warn(`Using default value for ${envKey}: ${defaultValue}`);
    }
    return defaultValue;
  };

  const config: Config = {
    // AWS
    region: awsGetRegion(),
    accountId: awsGetAccountId(),

    // EKS Cluster
    clusterName: getValue('EKS_CLUSTER_NAME', 'cluster_name'),
    clusterEndpoint: getValue('EKS_CLUSTER_ENDPOINT', 'cluster_endpoint'),

    // Bastion
    bastionInstanceId: getValue('BASTION_INSTANCE_ID', 'bastion_instance_id'),

    // S3
    s3Bucket: getValue('S3_BUCKET', 's3_bucket_name'),

    // IAM Roles
    workloadRoleArn: getValue('WORKLOAD_ROLE_ARN', 'workload_role_arn'),
    lbControllerRoleArn: getValue('LB_CONTROLLER_ROLE_ARN', 'lb_controller_role_arn'),
    karpenterRoleArn: getValue('KARPENTER_ROLE_ARN', 'karpenter_iam_role_arn'),

    // Karpenter
    karpenterQueueName: getValue('KARPENTER_QUEUE_NAME', 'karpenter_queue_name'),

    // VPC
    vpcId: getValue('VPC_ID', 'vpc_id'),

    // ECR
    ecrMlopsUrl: getValue('ECR_MLOPS_URL', 'ecr_mlops_url'),

    // API
    apiUrl: getValue('API_URL', 'api_url'),

    // Paths
    tfDir,

    // Raw terraform accessor
    tf,

    // Validation helper
    require(key: keyof Config): string {
      const value = this[key];
      if (!value) {
        throw new Error(`Required config '${key}' not found. Set via environment variable or terraform output.`);
      }
      return value as string;
    },

    // Check if all required values are present
    validate(requiredKeys: Array<keyof Config>): boolean {
      const missing = requiredKeys.filter(key => !this[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required config: ${missing.join(', ')}`);
      }
      return true;
    },

    // Strict validation using Zod schemas
    validateStrict(): { success: boolean; errors: string[] } {
      const dataToValidate = {
        region: this.region,
        accountId: this.accountId,
        clusterName: this.clusterName,
        clusterEndpoint: this.clusterEndpoint,
        bastionInstanceId: this.bastionInstanceId,
        s3Bucket: this.s3Bucket,
        workloadRoleArn: this.workloadRoleArn,
        lbControllerRoleArn: this.lbControllerRoleArn,
        karpenterRoleArn: this.karpenterRoleArn,
        karpenterQueueName: this.karpenterQueueName,
        vpcId: this.vpcId,
        ecrMlopsUrl: this.ecrMlopsUrl,
        apiUrl: this.apiUrl,
        tfDir: this.tfDir,
      };

      const result = ConfigSchema.safeParse(dataToValidate);
      if (result.success) {
        return { success: true, errors: [] };
      }

      const errors = result.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      return { success: false, errors };
    },
  };

  return config;
}

// ============================================================
// Re-exports from modular config files
// ============================================================

// Timeouts and polling intervals
export {
  TIMEOUTS,
  POLL_INTERVALS,
  secondsToMs,
  msToSeconds,
} from './timeouts.js';

// Paths and directories
export {
  PATHS,
  RELATIVE_PATHS,
  S3_PREFIXES,
  getOverlayPath,
  getTerraformPath,
} from './paths.js';

// ============================================================
// Version and Model constants
// ============================================================

// Version constants (not environment-specific)
export const VERSIONS = {
  kubectl: 'v1.29.12',
  karpenter: '1.1.0',
  vllmImage: 'vllm/vllm-openai:v0.6.4',
} as const;

// Model constants
export const MODELS = {
  llm: 'Qwen/Qwen2.5-1.5B-Instruct',
  embedding: 'intfloat/multilingual-e5-small',
} as const;

// ============================================================
// Runtime Constants
// ============================================================

// Default AWS region
export const DEFAULT_REGION = 'ap-northeast-1';

// Port constants
export const PORTS = {
  llmInference: 8000,
  app: 3000,
} as const;

// Deployment configuration (can be overridden by environment variables)
export const DEPLOYMENT = {
  // Private EKS mode (kubectl via bastion only)
  // Override: PRIVATE_EKS=false
  privateEks: process.env.PRIVATE_EKS !== 'false',

  // Default Kustomize overlay
  // Override: K8S_OVERLAY=staging
  defaultOverlay: (process.env.K8S_OVERLAY || 'local') as 'prod' | 'staging' | 'local',
} as const;
