/**
 * TerraformPhase - executes Terraform apply.
 *
 * Phase 2: Terraform Apply
 * - Runs terraform init if needed
 * - Runs terraform apply -auto-approve
 * - Returns terraform outputs
 */

import { TerraformRunner } from '../../../infrastructure/terraform/TerraformRunner.js';
import { OrphanCleaner } from '../../../infrastructure/terraform/OrphanCleaner.js';
import type { ExecutablePhase, PhaseContext, PhaseResult, TerraformResult } from './types.js';

/**
 * Options for TerraformPhase.
 */
export interface TerraformPhaseOptions {
  /** Skip terraform apply */
  skipApply?: boolean;
  /** Run terraform init if not initialized */
  autoInit?: boolean;
  /** Terraform is already initialized */
  tfInitialized?: boolean;
}

/**
 * Executes Terraform to provision infrastructure.
 */
export class TerraformPhase implements ExecutablePhase<TerraformResult> {
  readonly name = 'Terraform';
  readonly description = 'Applying Terraform configuration';
  private readonly options: TerraformPhaseOptions;

  constructor(options: TerraformPhaseOptions = {}) {
    this.options = {
      autoInit: true,
      ...options,
    };
  }

  async execute(context: PhaseContext): Promise<PhaseResult<TerraformResult>> {
    const { log, tfDir, region } = context;

    if (this.options.skipApply) {
      log.info('Skipping terraform apply (--skip-apply flag)');
      return this.getOutputsOnly(context);
    }

    const runner = new TerraformRunner(tfDir);

    // Initialize if needed
    if (this.options.autoInit && !this.options.tfInitialized) {
      const initOk = await runner.init();
      if (!initOk) {
        return { success: false, error: 'Terraform init failed' };
      }
    }

    // Cleanup orphan resources for idempotency
    log.info('Checking for orphan resources...');
    const cleaner = new OrphanCleaner({ tfDir, region });
    await cleaner.cleanupLogGroups();

    // Apply
    const applyOk = await runner.apply();
    if (!applyOk) {
      return { success: false, error: 'Terraform apply failed' };
    }

    // Get outputs
    const outputs = runner.getOutputs();
    if (!outputs.clusterName) {
      return { success: false, error: 'Cluster name not found in Terraform outputs' };
    }

    log.pass(`Cluster Name: ${outputs.clusterName}`);
    if (outputs.clusterEndpoint) log.pass(`Cluster Endpoint: ${outputs.clusterEndpoint}`);
    if (outputs.vpcId) log.pass(`VPC ID: ${outputs.vpcId}`);

    return {
      success: true,
      data: {
        clusterName: outputs.clusterName,
        clusterEndpoint: outputs.clusterEndpoint ?? undefined,
        vpcId: outputs.vpcId ?? undefined,
        bastionInstanceId: outputs.bastionInstanceId ?? undefined,
        bastionConnectCommand: outputs.bastionConnectCommand ?? undefined,
        clusterVersion: outputs.clusterVersion ?? undefined,
      },
    };
  }

  /**
   * Get outputs without applying.
   */
  private getOutputsOnly(context: PhaseContext): PhaseResult<TerraformResult> {
    const runner = new TerraformRunner(context.tfDir);
    const outputs = runner.getOutputs();

    if (!outputs.clusterName) {
      return { success: false, error: 'Cluster name not found in Terraform outputs' };
    }

    return {
      success: true,
      skipped: true,
      skipReason: 'Skip apply mode',
      data: {
        clusterName: outputs.clusterName,
        clusterEndpoint: outputs.clusterEndpoint ?? undefined,
        vpcId: outputs.vpcId ?? undefined,
        bastionInstanceId: outputs.bastionInstanceId ?? undefined,
        bastionConnectCommand: outputs.bastionConnectCommand ?? undefined,
        clusterVersion: outputs.clusterVersion ?? undefined,
      },
    };
  }
}
