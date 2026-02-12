/**
 * AWS EKS utilities.
 */

import { aws } from '../../shell/index.js';
import { awsGetRegion } from './core.js';
import { log } from '../../../framework/logging/index.js';
import {
  safeParseJson,
  EKSDescribeClusterSchema,
  EKSListNodeGroupsSchema,
  EKSDescribeNodeGroupSchema,
} from '../../types.js';
import type { RunResult, EKSNodeGroupInfo } from '../../types.js';

export function eksUpdateKubeconfig(clusterName: string, region?: string, profile = ''): RunResult {
  let cmd = `eks update-kubeconfig --name ${clusterName}`;
  if (profile) cmd += ` --profile ${profile}`;
  return aws(cmd, { throwOnError: false, region });
}

export function eksGetClusterInfo(clusterName: string, region?: string): unknown | null {
  try {
    const result = aws(`eks describe-cluster --name ${clusterName} --output json`, { silent: true, region });
    return safeParseJson(result, EKSDescribeClusterSchema);
  } catch (e: unknown) {
    log.debug(`eksGetClusterInfo failed for ${clusterName}: ${(e as Error).message || String(e)}`);
    return null;
  }
}

/**
 * Get EKS cluster status.
 * Returns 'ACTIVE', 'CREATING', 'FAILED', 'NOT_FOUND', etc.
 */
export function eksGetClusterStatus(clusterName: string, region?: string): string {
  const reg = region || awsGetRegion();
  const result = aws(
    `eks describe-cluster --name ${clusterName} --query 'cluster.status' --output text`,
    { ignoreError: true, region: reg }
  );
  return result || 'NOT_FOUND';
}

/**
 * Get EKS cluster version.
 */
export function eksGetClusterVersion(clusterName: string, region?: string): string | null {
  const reg = region || awsGetRegion();
  const result = aws(
    `eks describe-cluster --name ${clusterName} --query 'cluster.version' --output text`,
    { ignoreError: true, region: reg }
  );
  return result || null;
}

/**
 * List node groups for a cluster.
 */
export function eksListNodeGroups(clusterName: string, region?: string): string[] {
  const reg = region || awsGetRegion();
  const result = aws(
    `eks list-nodegroups --cluster-name ${clusterName} --output json`,
    { ignoreError: true, region: reg }
  );
  if (!result) return [];
  const data = safeParseJson(result, EKSListNodeGroupsSchema, () => {});
  return data?.nodegroups || [];
}

/**
 * Get detailed node group info including ASG and health issues.
 */
export function eksDescribeNodeGroup(
  clusterName: string,
  ngName: string,
  region?: string
): EKSNodeGroupInfo | null {
  const reg = region || awsGetRegion();
  const result = aws(
    `eks describe-nodegroup --cluster-name ${clusterName} --nodegroup-name ${ngName} --output json`,
    { ignoreError: true, region: reg }
  );
  if (!result) return null;

  const data = safeParseJson(result, EKSDescribeNodeGroupSchema, () => {});
  if (!data?.nodegroup) return null;

  const ng = data.nodegroup;
  return {
    name: ng.nodegroupName,
    status: ng.status,
    desiredSize: ng.scalingConfig?.desiredSize,
    asgName: ng.resources?.autoScalingGroups?.[0]?.name,
    healthIssues: ng.health?.issues || [],
  };
}

