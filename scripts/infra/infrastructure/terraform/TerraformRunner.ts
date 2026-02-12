/**
 * TerraformRunner - executes Terraform commands.
 *
 * Provides methods for:
 * - terraform init
 * - terraform apply -auto-approve (with streaming)
 * - terraform output parsing
 */

import { run as defaultRun, runStreaming as defaultRunStreaming } from '../shell/index.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import type { Logger } from '../../framework/types.js';

/**
 * Terraform output values dictionary
 */
export interface TfOutputMap {
  clusterName?: string | null;
  clusterEndpoint?: string | null;
  vpcId?: string | null;
  eksKubeconfigCommand?: string | null;
  bastionConnectCommand?: string | null;
  bastionInstanceId?: string | null;
  clusterVersion?: string | null;
}

/**
 * Dependencies for TerraformRunner
 */
export interface TerraformRunnerDependencies {
  run: typeof defaultRun;
  runStreaming: typeof defaultRunStreaming;
  log: Logger;
}

const defaultDependencies: TerraformRunnerDependencies = {
  run: defaultRun,
  runStreaming: defaultRunStreaming,
  log: defaultLog,
};

/**
 * Terraform output keys to fetch
 */
const TF_OUTPUT_KEYS = [
  'cluster_name',
  'cluster_endpoint',
  'vpc_id',
  'eks_kubeconfig_command',
  'bastion_connect_command',
  'bastion_instance_id',
] as const;

/**
 * Runs Terraform commands.
 *
 * @example
 * const tf = new TerraformRunner('/path/to/terraform');
 *
 * // Initialize
 * await tf.init();
 *
 * // Apply
 * const success = await tf.apply();
 *
 * // Get outputs
 * const outputs = tf.getOutputs();
 */
export class TerraformRunner {
  private deps: TerraformRunnerDependencies;

  constructor(
    private readonly tfDir: string,
    deps: Partial<TerraformRunnerDependencies> = {}
  ) {
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Get Terraform outputs as a dictionary.
   */
  getOutputs(): TfOutputMap {
    const outputs: TfOutputMap = {};

    for (const key of TF_OUTPUT_KEYS) {
      const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof TfOutputMap;
      outputs[camelKey] = this.deps.run(`terraform output -raw ${key}`, {
        cwd: this.tfDir,
        ignoreError: true,
      }) || null;
    }

    return outputs;
  }

  /**
   * Run terraform init.
   */
  async init(): Promise<boolean> {
    this.deps.log.info('Running terraform init...');
    try {
      this.deps.run('terraform init', { cwd: this.tfDir });
      this.deps.log.pass('Terraform initialized');
      return true;
    } catch {
      this.deps.log.fail('Terraform init failed');
      return false;
    }
  }

  /**
   * Check if terraform is initialized.
   */
  isInitialized(): boolean {
    const result = this.deps.run('ls -la .terraform', {
      cwd: this.tfDir,
      ignoreError: true,
    });
    return result !== null;
  }

  /**
   * Run terraform apply -auto-approve with streaming output.
   */
  async apply(): Promise<boolean> {
    this.deps.log.info('Running terraform apply with auto-approve...');
    this.deps.log.info('(This may take 15-20 minutes for EKS cluster creation)');

    try {
      await this.deps.runStreaming('terraform', ['apply', '-auto-approve'], this.tfDir);
      this.deps.log.pass('Terraform apply completed successfully');
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.deps.log.fail(`Terraform apply failed: ${message}`);
      return false;
    }
  }

  /**
   * Run terraform plan.
   */
  async plan(): Promise<boolean> {
    this.deps.log.info('Running terraform plan...');
    try {
      await this.deps.runStreaming('terraform', ['plan'], this.tfDir);
      this.deps.log.pass('Terraform plan completed');
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.deps.log.fail(`Terraform plan failed: ${message}`);
      return false;
    }
  }

  /**
   * Run terraform destroy with auto-approve.
   */
  async destroy(): Promise<boolean> {
    this.deps.log.info('Running terraform destroy with auto-approve...');
    try {
      await this.deps.runStreaming('terraform', ['destroy', '-auto-approve'], this.tfDir);
      this.deps.log.pass('Terraform destroy completed');
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.deps.log.fail(`Terraform destroy failed: ${message}`);
      return false;
    }
  }

  /**
   * Get a single terraform output value.
   */
  getOutput(key: string): string | null {
    return this.deps.run(`terraform output -raw ${key}`, {
      cwd: this.tfDir,
      ignoreError: true,
    }) || null;
  }

  /**
   * List resources in terraform state.
   */
  stateList(): string[] {
    const result = this.deps.run('terraform state list', {
      cwd: this.tfDir,
      ignoreError: true,
    });
    if (!result) return [];
    return result.split('\n').filter(line => line.trim().length > 0);
  }
}
