/**
 * Terraform Output Utilities
 *
 * Functions for reading Terraform state outputs.
 *
 * NOTE: If more Terraform utilities are needed (backend, workspace, state management),
 * consider splitting this module into:
 *   - outputs.ts (current)
 *   - backend.ts
 *   - workspace.ts
 */

import { execSync } from 'child_process';
import { run } from '../shell/index.js';
import type { TerraformOutputs } from '../types.js';

export function terraformOutput(outputName: string, terraformDir: string): string | null {
  try {
    return run(`terraform -chdir=${terraformDir} output -raw ${outputName}`, { silent: true });
  } catch {
    return null;
  }
}

export function createTerraformOutputs(tfDir: string): TerraformOutputs {
  const cache: Record<string, string | null> = {};
  const get = (key: string): string | null => {
    if (cache[key] !== undefined) return cache[key];
    try {
      cache[key] = execSync(`terraform -chdir=${tfDir} output -raw ${key} 2>/dev/null`, { encoding: 'utf8' }).trim();
    } catch {
      cache[key] = null;
    }
    return cache[key];
  };
  return {
    get,
    s3Bucket: () => get('s3_bucket_name') || process.env.S3_BUCKET,
    apiUrl: () => get('api_url') || process.env.API_URL,
    bastionId: () => get('bastion_instance_id'),
    lbRoleArn: () => get('lb_controller_role_arn'),
    vpcId: () => get('vpc_id'),
    clusterName: () => get('cluster_name'),
    clusterEndpoint: () => get('cluster_endpoint'),
    karpenterRoleArn: () => get('karpenter_iam_role_arn'),
    karpenterQueueName: () => get('karpenter_queue_name'),
    workloadRoleArn: () => get('workload_role_arn'),
    ecrMlopsUrl: () => get('ecr_mlops_url'),
  };
}
