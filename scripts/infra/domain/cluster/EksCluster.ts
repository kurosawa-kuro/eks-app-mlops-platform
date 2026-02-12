/**
 * EKS Cluster Domain Entity
 *
 * Represents the state and behavior of an EKS cluster.
 */

export type EksClusterStatus = 'CREATING' | 'ACTIVE' | 'UPDATING' | 'DELETING' | 'FAILED';

/**
 * Raw state of an EKS cluster.
 */
export interface EksClusterState {
  name: string;
  status: EksClusterStatus;
  version: string;
  endpoint?: string;
  arn?: string;
  vpcId?: string;
  securityGroupIds?: string[];
  createdAt?: Date;
}

/**
 * Domain entity representing an EKS cluster.
 *
 * @example
 * const cluster = new EksCluster({
 *   name: 'my-cluster',
 *   status: 'ACTIVE',
 *   version: '1.29',
 *   endpoint: 'https://...'
 * });
 *
 * if (cluster.isReady()) {
 *   console.log('Cluster is ready at:', cluster.getEndpoint());
 * }
 */
export class EksCluster {
  constructor(private readonly state: EksClusterState) {}

  /**
   * Get the cluster name.
   */
  get name(): string {
    return this.state.name;
  }

  /**
   * Get the cluster status.
   */
  get status(): EksClusterStatus {
    return this.state.status;
  }

  /**
   * Get the Kubernetes version.
   */
  get version(): string {
    return this.state.version;
  }

  /**
   * Get the cluster ARN.
   */
  get arn(): string | undefined {
    return this.state.arn;
  }

  /**
   * Get the VPC ID.
   */
  get vpcId(): string | undefined {
    return this.state.vpcId;
  }

  /**
   * Check if the cluster is ready for operations.
   */
  isReady(): boolean {
    return this.state.status === 'ACTIVE';
  }

  /**
   * Check if the cluster is being created.
   */
  isCreating(): boolean {
    return this.state.status === 'CREATING';
  }

  /**
   * Check if the cluster is being updated.
   */
  isUpdating(): boolean {
    return this.state.status === 'UPDATING';
  }

  /**
   * Check if the cluster is being deleted.
   */
  isDeleting(): boolean {
    return this.state.status === 'DELETING';
  }

  /**
   * Check if the cluster has failed.
   */
  isFailed(): boolean {
    return this.state.status === 'FAILED';
  }

  /**
   * Check if the cluster is in a transitional state.
   */
  isTransitioning(): boolean {
    return this.isCreating() || this.isUpdating() || this.isDeleting();
  }

  /**
   * Get the cluster API endpoint.
   */
  getEndpoint(): string | undefined {
    return this.state.endpoint;
  }

  /**
   * Check if the cluster has an endpoint.
   */
  hasEndpoint(): boolean {
    return this.state.endpoint !== undefined && this.state.endpoint.length > 0;
  }

  /**
   * Get the security group IDs.
   */
  getSecurityGroupIds(): string[] {
    return this.state.securityGroupIds ?? [];
  }

  /**
   * Get creation timestamp.
   */
  getCreatedAt(): Date | undefined {
    return this.state.createdAt;
  }

  /**
   * Get the raw state.
   */
  toState(): EksClusterState {
    return { ...this.state };
  }
}
