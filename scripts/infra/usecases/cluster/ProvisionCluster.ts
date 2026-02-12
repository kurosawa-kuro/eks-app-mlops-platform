/**
 * ProvisionCluster UseCase
 *
 * Provisions an EKS cluster following the 起承転結 narrative:
 * - 起: Preflight checks, validation
 * - 承: Terraform apply
 * - 転: Wait for cluster, node groups, bastion
 * - 結: Smoke tests, verification
 */

import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { Overlay, type OverlayType } from '../../domain/index.js';
import { ClusterProvisioningError } from '../../domain/errors/index.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import {
  PreflightPhase,
  TerraformPhase,
  ClusterWaitPhase,
  NodeGroupWaitPhase,
  ASGWaitPhase,
  BastionWaitPhase,
  NodeReadyPhase,
  SmokeTestPhase,
  type PhaseContext,
  type PreflightResult,
  type TerraformResult,
  type NodeGroupResult,
  type K8sNodeInfo,
} from './phases/index.js';

/**
 * Input for cluster provisioning.
 */
export interface ProvisionClusterInput {
  /** Target overlay (local, staging, prod) */
  overlay: OverlayType;
  /** Skip terraform apply (use existing state) */
  skipApply?: boolean;
  /** Skip smoke tests */
  skipSmokeTests?: boolean;
  /** Terraform directory */
  tfDir: string;
  /** AWS region */
  region: string;
  /** Disable log file writing */
  noLog?: boolean;
}

/**
 * Output from cluster provisioning.
 */
export interface ProvisionClusterOutput {
  /** Cluster name */
  clusterName: string;
  /** Cluster API endpoint */
  endpoint?: string;
  /** VPC ID */
  vpcId?: string;
  /** Number of nodes provisioned */
  nodeCount: number;
  /** Cluster version */
  clusterVersion?: string;
  /** Nodes information */
  nodes: K8sNodeInfo[];
  /** Bastion instance ID (if private EKS) */
  bastionInstanceId?: string;
}

/**
 * Provisions an EKS cluster with all required resources.
 *
 * @example
 * const container = createInfraContainer();
 * const useCase = new ProvisionCluster(container);
 *
 * const result = await useCase.execute({
 *   overlay: 'prod',
 *   tfDir: '/path/to/terraform',
 *   region: 'ap-northeast-1',
 * });
 *
 * if (result.success) {
 *   console.log('Cluster created:', result.data.clusterName);
 * }
 */
export class ProvisionCluster extends UseCase<ProvisionClusterInput, ProvisionClusterOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: ProvisionClusterInput): Promise<UseCaseResult<ProvisionClusterOutput>> {
    this.startTimer();

    const overlay = Overlay.create(input.overlay);
    const log = defaultLog;

    // Build the shared context
    let context: PhaseContext = {
      region: input.region,
      tfDir: input.tfDir,
      log,
    };

    let preflightResult: PreflightResult | undefined;
    let terraformResult: TerraformResult | undefined;
    let nodeGroupResult: NodeGroupResult | undefined;
    let nodes: K8sNodeInfo[] = [];

    try {
      // ============================================================
      // 起: Setup - Preflight checks
      // ============================================================
      await this.runPhase('setup', 'Preflight', 'Running preflight checks', async () => {
        const phase = new PreflightPhase();
        const result = await phase.execute(context);
        if (!result.success) {
          throw new ClusterProvisioningError('Preflight', result.error ?? 'Unknown error');
        }
        preflightResult = result.data;
      });

      // ============================================================
      // 承: Action - Terraform Apply
      // ============================================================
      await this.runPhase('action', 'Terraform', 'Applying Terraform', async () => {
        const phase = new TerraformPhase({
          skipApply: input.skipApply,
          tfInitialized: preflightResult?.tfInitialized,
        });
        const result = await phase.execute(context);
        if (!result.success) {
          throw new ClusterProvisioningError('Terraform', result.error ?? 'Unknown error');
        }
        terraformResult = result.data;

        // Update context with terraform outputs
        context = {
          ...context,
          clusterName: terraformResult?.clusterName,
          bastionInstanceId: terraformResult?.bastionInstanceId,
        };
      });

      // ============================================================
      // 転: Transition - Wait for resources
      // ============================================================

      // Phase 3: Cluster ACTIVE
      await this.runPhase('transition', 'Cluster Wait', 'Waiting for EKS cluster', async () => {
        const phase = new ClusterWaitPhase();
        const result = await phase.execute(context);
        if (!result.success) {
          throw new ClusterProvisioningError('Cluster Wait', result.error ?? 'Unknown error');
        }
      });

      // Phase 4: NodeGroup ACTIVE
      await this.runPhase('transition', 'NodeGroup Wait', 'Waiting for node groups', async () => {
        const phase = new NodeGroupWaitPhase();
        const result = await phase.execute(context);
        if (!result.success) {
          throw new ClusterProvisioningError('NodeGroup Wait', result.error ?? 'Unknown error');
        }
        nodeGroupResult = result.data;

        // Update context with node group info
        context = {
          ...context,
          expectedNodeCount: nodeGroupResult?.expectedNodeCount,
          primaryAsgName: nodeGroupResult?.primaryAsgName,
        };
      });

      // Phase 5: ASG Instance READY
      await this.runPhase('transition', 'ASG Wait', 'Waiting for ASG instances', async () => {
        const phase = new ASGWaitPhase();
        await phase.execute(context);
        // ASG wait is non-fatal, continue even if not all instances are ready
      });

      // Phase 6: Bastion SSM Online
      await this.runPhase('transition', 'Bastion Wait', 'Waiting for bastion SSM', async () => {
        const phase = new BastionWaitPhase();
        const result = await phase.execute(context);
        if (!result.success && !result.skipped) {
          throw new ClusterProvisioningError('Bastion Wait', result.error ?? 'Unknown error');
        }
      });

      // Phase 7: Node Ready - SKIPPED
      // kubectl get nodes requires EKS Access Entry RBAC propagation (30-60s after cluster creation)
      // This check is deferred to eks-k8s-deploy or manual verification
      this.skipPhase('transition', 'Node Ready', 'Checking K8s nodes', 'RBAC propagation not yet complete');

      // ============================================================
      // 結: Verification - Smoke tests (infrastructure only)
      // ============================================================
      await this.runPhase('verification', 'Smoke Tests', 'Running infrastructure smoke tests', async () => {
        const phase = new SmokeTestPhase({ skipE2E: true });
        const result = await phase.execute(context);
        // Smoke test failure is non-fatal but we log it
        if (!result.success && result.data?.failed) {
          log.warn(`${result.data.failed} smoke tests failed`);
        }
      });

      // Build success result
      return this.buildResult({
        clusterName: terraformResult?.clusterName ?? 'unknown',
        endpoint: terraformResult?.clusterEndpoint,
        vpcId: terraformResult?.vpcId,
        clusterVersion: terraformResult?.clusterVersion,
        nodeCount: nodes.filter(n => n.ready).length,
        nodes,
        bastionInstanceId: terraformResult?.bastionInstanceId,
      });

    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }
}
