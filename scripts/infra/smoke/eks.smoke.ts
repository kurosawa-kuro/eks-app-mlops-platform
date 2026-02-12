/**
 * EKS Smoke Test
 *
 * Verifies EKS cluster health and status.
 */

import { eksGetClusterInfo } from '../infrastructure/aws/index.js';
import { createConfig } from '../config/index.js';
import { createSmoke, ok, warn, fail } from './helpers.js';

export const eksSmoke = createSmoke('eks', () => {
  const config = createConfig();
  const clusterName = config.clusterName;

  if (!clusterName) {
    return warn('Cluster name not configured (terraform output or EKS_CLUSTER_NAME)');
  }

  const clusterInfo = eksGetClusterInfo(clusterName, config.region) as {
    cluster?: {
      status?: string;
      version?: string;
      endpoint?: string;
    };
  } | null;

  if (!clusterInfo?.cluster) {
    return fail(`Cluster '${clusterName}' not found`);
  }

  const { status, version, endpoint } = clusterInfo.cluster;

  if (status !== 'ACTIVE') {
    return fail(`Cluster status: ${status} (expected: ACTIVE)`, { clusterName, status, version });
  }

  return ok(`Cluster '${clusterName}' is ACTIVE (v${version})`, { clusterName, status, version, endpoint });
});
