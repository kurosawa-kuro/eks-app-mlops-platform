/**
 * Secret Environment Variable Schema (Zod)
 *
 * Defines and validates sensitive environment variables used by infra scripts.
 * These include AWS resource identifiers, IAM roles, and infrastructure endpoints.
 */

import { z } from 'zod';

// ============================================================
// BOUNDARY: Secret Environment Variables
// ============================================================

export const SecretEnvSchema = z.object({
  // Infrastructure (sensitive)
  S3_BUCKET: z.string().optional(),
  API_URL: z.string().optional(),
  EKS_CLUSTER_NAME: z.string().optional(),
  EKS_CLUSTER_ENDPOINT: z.string().optional(),
  BASTION_INSTANCE_ID: z.string().optional(),

  // IAM Roles
  WORKLOAD_ROLE_ARN: z.string().optional(),
  LB_CONTROLLER_ROLE_ARN: z.string().optional(),
  KARPENTER_ROLE_ARN: z.string().optional(),

  // Karpenter
  KARPENTER_QUEUE_NAME: z.string().optional(),

  // VPC
  VPC_ID: z.string().optional(),

  // ECR
  ECR_MLOPS_URL: z.string().optional(),
});

export type SecretEnv = z.infer<typeof SecretEnvSchema>;

/**
 * Load and validate secret environment variables.
 */
export function loadSecretEnv(): Partial<SecretEnv> {
  const result = SecretEnvSchema.safeParse(process.env);
  if (!result.success) {
    return {};
  }
  return result.data;
}
