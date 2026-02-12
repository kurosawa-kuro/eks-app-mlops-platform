/**
 * Node Group Domain Entity
 *
 * Represents the state and behavior of an EKS node group.
 */

export type NodeGroupStatus =
  | 'CREATING'
  | 'ACTIVE'
  | 'UPDATING'
  | 'DELETING'
  | 'CREATE_FAILED'
  | 'DELETE_FAILED'
  | 'DEGRADED';

/**
 * Health issue reported for a node group.
 */
export interface NodeGroupHealthIssue {
  code: string;
  message: string;
  resourceIds?: string[];
}

/**
 * Raw state of a node group.
 */
export interface NodeGroupState {
  name: string;
  clusterName: string;
  status: NodeGroupStatus;
  desiredSize: number;
  minSize: number;
  maxSize: number;
  instanceTypes?: string[];
  amiType?: string;
  capacityType?: 'ON_DEMAND' | 'SPOT';
  healthIssues: NodeGroupHealthIssue[];
  asgName?: string;
}

/**
 * Domain entity representing an EKS node group.
 *
 * @example
 * const nodeGroup = new NodeGroup({
 *   name: 'workers',
 *   clusterName: 'my-cluster',
 *   status: 'ACTIVE',
 *   desiredSize: 3,
 *   minSize: 1,
 *   maxSize: 5,
 *   healthIssues: []
 * });
 *
 * if (nodeGroup.isHealthy()) {
 *   console.log('Node group is healthy');
 * }
 */
export class NodeGroup {
  constructor(private readonly state: NodeGroupState) {}

  /**
   * Get the node group name.
   */
  get name(): string {
    return this.state.name;
  }

  /**
   * Get the cluster name.
   */
  get clusterName(): string {
    return this.state.clusterName;
  }

  /**
   * Get the node group status.
   */
  get status(): NodeGroupStatus {
    return this.state.status;
  }

  /**
   * Get the desired node count.
   */
  get desiredSize(): number {
    return this.state.desiredSize;
  }

  /**
   * Get the minimum node count.
   */
  get minSize(): number {
    return this.state.minSize;
  }

  /**
   * Get the maximum node count.
   */
  get maxSize(): number {
    return this.state.maxSize;
  }

  /**
   * Get the ASG name.
   */
  get asgName(): string | undefined {
    return this.state.asgName;
  }

  /**
   * Check if the node group is ready for operations.
   */
  isReady(): boolean {
    return this.state.status === 'ACTIVE';
  }

  /**
   * Check if the node group is being created.
   */
  isCreating(): boolean {
    return this.state.status === 'CREATING';
  }

  /**
   * Check if the node group is being updated.
   */
  isUpdating(): boolean {
    return this.state.status === 'UPDATING';
  }

  /**
   * Check if the node group is being deleted.
   */
  isDeleting(): boolean {
    return this.state.status === 'DELETING';
  }

  /**
   * Check if the node group has failed.
   */
  isFailed(): boolean {
    return this.state.status === 'CREATE_FAILED' || this.state.status === 'DELETE_FAILED';
  }

  /**
   * Check if the node group is degraded.
   */
  isDegraded(): boolean {
    return this.state.status === 'DEGRADED';
  }

  /**
   * Check if the node group is in a transitional state.
   */
  isTransitioning(): boolean {
    return this.isCreating() || this.isUpdating() || this.isDeleting();
  }

  /**
   * Check if the node group is healthy (active and no health issues).
   */
  isHealthy(): boolean {
    return this.isReady() && this.state.healthIssues.length === 0;
  }

  /**
   * Get health issues.
   */
  getHealthIssues(): NodeGroupHealthIssue[] {
    return [...this.state.healthIssues];
  }

  /**
   * Check if there are health issues.
   */
  hasHealthIssues(): boolean {
    return this.state.healthIssues.length > 0;
  }

  /**
   * Get the instance types used.
   */
  getInstanceTypes(): string[] {
    return this.state.instanceTypes ?? [];
  }

  /**
   * Get the AMI type.
   */
  getAmiType(): string | undefined {
    return this.state.amiType;
  }

  /**
   * Get the capacity type.
   */
  getCapacityType(): 'ON_DEMAND' | 'SPOT' | undefined {
    return this.state.capacityType;
  }

  /**
   * Check if using spot instances.
   */
  isSpot(): boolean {
    return this.state.capacityType === 'SPOT';
  }

  /**
   * Get the raw state.
   */
  toState(): NodeGroupState {
    return { ...this.state };
  }
}
