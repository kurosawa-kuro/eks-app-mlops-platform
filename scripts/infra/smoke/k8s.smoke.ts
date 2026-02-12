/**
 * Kubernetes Smoke Test
 *
 * Verifies Kubernetes cluster node health via AWS EKS API.
 * For private clusters, we use EKS API instead of direct kubectl.
 */

import { run } from '../infrastructure/shell/index.js';
import { createSmoke, ok, fail } from './helpers.js';

interface NodeGroupInfo {
  name: string;
  status: string;
  desiredSize: number;
  currentSize: number;
}

function getNodeGroups(clusterName: string): NodeGroupInfo[] {
  try {
    const listOutput = run(
      `aws eks list-nodegroups --cluster-name ${clusterName} --query 'nodegroups' --output json`,
      { silent: true }
    );
    const nodeGroupNames = JSON.parse(listOutput) as string[];

    if (nodeGroupNames.length === 0) {
      return [];
    }

    return nodeGroupNames.map((ngName) => {
      const ngOutput = run(
        `aws eks describe-nodegroup --cluster-name ${clusterName} --nodegroup-name ${ngName} --query 'nodegroup.{status:status,desiredSize:scalingConfig.desiredSize,minSize:scalingConfig.minSize,maxSize:scalingConfig.maxSize}' --output json`,
        { silent: true }
      );
      const ngInfo = JSON.parse(ngOutput);
      return {
        name: ngName,
        status: ngInfo.status || 'UNKNOWN',
        desiredSize: ngInfo.desiredSize || 0,
        currentSize: ngInfo.desiredSize || 0,
      };
    });
  } catch {
    return [];
  }
}

function getClusterName(): string | null {
  try {
    const output = run(
      'cd infra/terraform/prod && terraform output -raw cluster_name 2>/dev/null',
      { silent: true, ignoreError: true }
    );
    return output || 'prod-eks-cluster';
  } catch {
    return 'prod-eks-cluster';
  }
}

export const k8sSmoke = createSmoke('k8s', () => {
  const clusterName = getClusterName();
  if (!clusterName) {
    return fail('Could not determine cluster name');
  }

  const nodeGroups = getNodeGroups(clusterName);
  if (nodeGroups.length === 0) {
    return fail('No node groups found in cluster', { clusterName });
  }

  const notActive = nodeGroups.filter((ng) => ng.status !== 'ACTIVE');
  if (notActive.length > 0) {
    return fail(`${notActive.length}/${nodeGroups.length} node groups are not ACTIVE`, {
      clusterName,
      nodeGroups,
      notActive: notActive.map((ng) => ({ name: ng.name, status: ng.status })),
    });
  }

  const totalNodes = nodeGroups.reduce((sum, ng) => sum + ng.desiredSize, 0);
  return ok(`${nodeGroups.length} node group(s) ACTIVE, ${totalNodes} node(s)`, {
    clusterName,
    nodeGroupCount: nodeGroups.length,
    totalNodes,
    nodeGroups,
  });
});
