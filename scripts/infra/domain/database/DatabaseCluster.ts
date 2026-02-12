/**
 * Database Cluster Domain Entity
 *
 * Represents the state and behavior of a PostgreSQL cluster (CloudNativePG).
 */

export type DatabaseStatus = 'Creating' | 'Ready' | 'Failed' | 'Unknown' | 'Updating';

/**
 * Raw state of a database cluster.
 */
export interface DatabaseClusterState {
  name: string;
  namespace: string;
  status: DatabaseStatus;
  instances: number;
  readyInstances: number;
  primaryPod?: string;
  primaryService?: string;
  secretName?: string;
  version?: string;
  storage?: string;
}

/**
 * Domain entity representing a CloudNativePG database cluster.
 *
 * @example
 * const db = new DatabaseCluster({
 *   name: 'app-db',
 *   namespace: 'default',
 *   status: 'Ready',
 *   instances: 3,
 *   readyInstances: 3
 * });
 *
 * if (db.isHealthy()) {
 *   console.log('Database is ready with', db.readyInstances, 'instances');
 * }
 */
export class DatabaseCluster {
  constructor(private readonly state: DatabaseClusterState) {}

  /**
   * Get the cluster name.
   */
  get name(): string {
    return this.state.name;
  }

  /**
   * Get the namespace.
   */
  get namespace(): string {
    return this.state.namespace;
  }

  /**
   * Get the cluster status.
   */
  get status(): DatabaseStatus {
    return this.state.status;
  }

  /**
   * Get the desired instance count.
   */
  get instances(): number {
    return this.state.instances;
  }

  /**
   * Get the ready instance count.
   */
  get readyInstances(): number {
    return this.state.readyInstances;
  }

  /**
   * Get the PostgreSQL version.
   */
  get version(): string | undefined {
    return this.state.version;
  }

  /**
   * Get the primary pod name.
   */
  get primaryPod(): string | undefined {
    return this.state.primaryPod;
  }

  /**
   * Get the primary service name.
   */
  get primaryService(): string | undefined {
    return this.state.primaryService;
  }

  /**
   * Get the secret name containing credentials.
   */
  get secretName(): string | undefined {
    return this.state.secretName;
  }

  /**
   * Check if the database cluster is ready.
   */
  isReady(): boolean {
    return this.state.status === 'Ready';
  }

  /**
   * Check if the database cluster is being created.
   */
  isCreating(): boolean {
    return this.state.status === 'Creating';
  }

  /**
   * Check if the database cluster is being updated.
   */
  isUpdating(): boolean {
    return this.state.status === 'Updating';
  }

  /**
   * Check if the database cluster has failed.
   */
  isFailed(): boolean {
    return this.state.status === 'Failed';
  }

  /**
   * Check if the status is unknown.
   */
  isUnknown(): boolean {
    return this.state.status === 'Unknown';
  }

  /**
   * Check if all instances are ready.
   */
  allInstancesReady(): boolean {
    return this.state.readyInstances >= this.state.instances;
  }

  /**
   * Check if the cluster is healthy (ready and all instances up).
   */
  isHealthy(): boolean {
    return this.isReady() && this.allInstancesReady();
  }

  /**
   * Get the connection endpoint (service name).
   */
  getConnectionEndpoint(): string {
    return this.state.primaryService ?? `${this.state.name}-rw.${this.state.namespace}.svc`;
  }

  /**
   * Get the read-only endpoint.
   */
  getReadOnlyEndpoint(): string {
    return `${this.state.name}-ro.${this.state.namespace}.svc`;
  }

  /**
   * Get the storage size.
   */
  getStorage(): string | undefined {
    return this.state.storage;
  }

  /**
   * Get the raw state.
   */
  toState(): DatabaseClusterState {
    return { ...this.state };
  }
}
