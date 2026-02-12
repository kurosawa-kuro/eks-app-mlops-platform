/**
 * Cluster Domain Errors
 *
 * Errors specific to EKS cluster operations.
 */

import { DomainError, NotFoundError } from './DomainError.js';

/**
 * Error thrown when a cluster is not found.
 */
export class ClusterNotFoundError extends NotFoundError {
  readonly code = 'CLUSTER_NOT_FOUND';

  constructor(clusterName: string) {
    super(`Cluster not found: ${clusterName}`, 'EKSCluster', clusterName);
  }
}

/**
 * Error thrown when a cluster is not in the expected state.
 */
export class ClusterNotReadyError extends DomainError {
  readonly code = 'CLUSTER_NOT_READY';

  constructor(
    public readonly clusterName: string,
    public readonly currentStatus: string
  ) {
    super(`Cluster '${clusterName}' is not ready. Current status: ${currentStatus}`);
  }
}

/**
 * Error thrown when a node group is not found.
 */
export class NodeGroupNotFoundError extends NotFoundError {
  readonly code = 'NODE_GROUP_NOT_FOUND';

  constructor(
    public readonly clusterName: string,
    nodeGroupName: string
  ) {
    super(
      `Node group '${nodeGroupName}' not found in cluster '${clusterName}'`,
      'NodeGroup',
      nodeGroupName
    );
  }
}

/**
 * Error thrown when a node group has health issues.
 */
export class NodeGroupUnhealthyError extends DomainError {
  readonly code = 'NODE_GROUP_UNHEALTHY';

  constructor(
    public readonly nodeGroupName: string,
    public readonly issues: Array<{ code: string; message: string }>
  ) {
    const issueMessages = issues.map(i => `${i.code}: ${i.message}`).join(', ');
    super(`Node group '${nodeGroupName}' has health issues: ${issueMessages}`);
  }
}

/**
 * Error thrown when no nodes are available.
 */
export class NoNodesAvailableError extends DomainError {
  readonly code = 'NO_NODES_AVAILABLE';

  constructor(public readonly clusterName: string) {
    super(`No nodes are available in cluster '${clusterName}'`);
  }
}

/**
 * Error thrown when the bastion host is not accessible.
 */
export class BastionNotAccessibleError extends DomainError {
  readonly code = 'BASTION_NOT_ACCESSIBLE';

  constructor(
    public readonly instanceId: string,
    public readonly reason: string
  ) {
    super(`Bastion host '${instanceId}' is not accessible: ${reason}`);
  }
}

/**
 * Error thrown when cluster provisioning fails.
 */
export class ClusterProvisioningError extends DomainError {
  readonly code = 'CLUSTER_PROVISIONING_FAILED';

  constructor(
    public readonly phase: string,
    public readonly details: string
  ) {
    super(`Cluster provisioning failed at phase '${phase}': ${details}`);
  }
}
