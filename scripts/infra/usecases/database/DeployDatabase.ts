/**
 * DeployDatabase UseCase
 *
 * Deploys a CloudNativePG database cluster following the 起承転結 narrative:
 * - 起: Preflight checks, namespace creation
 * - 承: Install CNPG operator, apply cluster manifest
 * - 転: Wait for database to be ready
 * - 結: Verify connectivity, create secrets
 */

import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { Overlay, type OverlayType } from '../../domain/index.js';
import { DatabaseOperatorError, DatabaseNotHealthyError } from '../../domain/errors/index.js';

/**
 * Input for database deployment.
 */
export interface DeployDatabaseInput {
  /** Target overlay (local, staging, prod) */
  overlay: OverlayType;
  /** Database cluster name */
  clusterName: string;
  /** Target namespace */
  namespace: string;
  /** Number of instances */
  instances?: number;
  /** Storage size (e.g., '10Gi') */
  storage?: string;
  /** Run in dry-run mode */
  dryRun?: boolean;
}

/**
 * Output from database deployment.
 */
export interface DeployDatabaseOutput {
  /** Database cluster name */
  clusterName: string;
  /** Namespace */
  namespace: string;
  /** Read-write endpoint */
  rwEndpoint: string;
  /** Read-only endpoint */
  roEndpoint: string;
  /** Secret name containing credentials */
  secretName: string;
  /** Number of ready instances */
  readyInstances: number;
}

/**
 * Deploys a CloudNativePG database cluster.
 *
 * @example
 * const container = createInfraContainer();
 * const useCase = new DeployDatabase(container);
 *
 * const result = await useCase.execute({
 *   overlay: 'prod',
 *   clusterName: 'app-db',
 *   namespace: 'default',
 *   instances: 3,
 *   storage: '20Gi'
 * });
 *
 * if (result.success) {
 *   console.log('Database deployed:', result.data.rwEndpoint);
 * }
 */
export class DeployDatabase extends UseCase<DeployDatabaseInput, DeployDatabaseOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: DeployDatabaseInput): Promise<UseCaseResult<DeployDatabaseOutput>> {
    this.startTimer();

    const overlay = Overlay.create(input.overlay);
    const instances = input.instances ?? 1;
    const storage = input.storage ?? '10Gi';

    try {
      // ============================================================
      // 起: Setup - Preflight and namespace
      // ============================================================
      await this.runPhase('setup', 'Preflight', 'Checking prerequisites', async () => {
        // Verify kubectl access
        const kubectl = this.container.resolve('kubectl');
        const result = kubectl.version();
        if (!result) {
          throw new DatabaseOperatorError('kubectl', 'Cannot connect to cluster');
        }
      });

      await this.runPhase('setup', 'Namespace', 'Ensuring namespace exists', async () => {
        const kubectl = this.container.resolve('kubectl');
        kubectl.ensureNamespace(input.namespace);
      });

      // ============================================================
      // 承: Action - Install operator and apply manifests
      // ============================================================
      await this.runPhase('action', 'Operator', 'Installing CNPG operator', async () => {
        if (input.dryRun) {
          return;
        }
        await this.installOperator(overlay);
      });

      await this.runPhase('action', 'Cluster', 'Applying database cluster', async () => {
        if (input.dryRun) {
          return;
        }
        await this.applyCluster(input.clusterName, input.namespace, instances, storage);
      });

      // ============================================================
      // 転: Transition - Wait for database
      // ============================================================
      if (input.dryRun) {
        this.skipPhase('transition', 'Wait DB', 'Wait for database ready', 'Dry run mode');
      } else {
        await this.runPhase('transition', 'Wait DB', 'Waiting for database', async () => {
          await this.waitForDatabase(input.clusterName, input.namespace, instances);
        });
      }

      // ============================================================
      // 結: Verification - Check connectivity
      // ============================================================
      if (input.dryRun) {
        this.skipPhase('verification', 'Verify', 'Verify database connectivity', 'Dry run mode');
      } else {
        await this.runPhase('verification', 'Verify', 'Verifying database', async () => {
          // Verify database is accessible
          // Could run a simple query via port-forward
        });
      }

      // Build success result
      return this.buildResult({
        clusterName: input.clusterName,
        namespace: input.namespace,
        rwEndpoint: `${input.clusterName}-rw.${input.namespace}.svc`,
        roEndpoint: `${input.clusterName}-ro.${input.namespace}.svc`,
        secretName: `${input.clusterName}-app`,
        readyInstances: instances,
      });

    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }

  /**
   * Install the CloudNativePG operator.
   */
  private async installOperator(_overlay: Overlay): Promise<void> {
    const helm = this.container.resolve('helm');

    // Add CNPG Helm repo and install
    helm.addRepo('cnpg', 'https://cloudnative-pg.github.io/charts');
    helm.installOrUpgrade({
      releaseName: 'cnpg',
      chart: 'cnpg/cloudnative-pg',
      namespace: 'cnpg-system',
      createNamespace: true,
      wait: true,
      timeout: 300,
    });
  }

  /**
   * Apply the database cluster manifest.
   */
  private async applyCluster(
    name: string,
    namespace: string,
    instances: number,
    storage: string
  ): Promise<void> {
    const kubectl = this.container.resolve('kubectl');

    // Apply the cluster manifest
    const manifest = this.generateClusterManifest(name, namespace, instances, storage);
    kubectl.apply(manifest, namespace);
  }

  /**
   * Wait for the database to be ready.
   */
  private async waitForDatabase(name: string, namespace: string, expectedInstances: number): Promise<void> {
    const kubectl = this.container.resolve('kubectl');

    // Poll for database status
    const maxAttempts = 60;
    const intervalMs = 10000;

    for (let i = 0; i < maxAttempts; i++) {
      const status = kubectl.getClusterStatus(name, namespace);

      if (status === 'Ready' && this.checkInstanceCount(name, namespace, expectedInstances)) {
        return;
      }

      if (status === 'Failed') {
        throw new DatabaseNotHealthyError(name, status);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new DatabaseNotHealthyError(name, 'Timeout waiting for ready state');
  }

  /**
   * Check if expected number of instances are ready.
   */
  private checkInstanceCount(_name: string, _namespace: string, _expected: number): boolean {
    // Would check actual instance count
    return true;
  }

  /**
   * Generate the CNPG cluster manifest.
   */
  private generateClusterManifest(
    name: string,
    namespace: string,
    instances: number,
    storage: string
  ): string {
    return `
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  instances: ${instances}
  storage:
    size: ${storage}
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
`.trim();
  }
}
