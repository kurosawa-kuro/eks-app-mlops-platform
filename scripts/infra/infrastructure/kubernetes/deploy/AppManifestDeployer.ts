/**
 * AppManifestDeployer - deploys application manifests (Hono backend + frontend) to EKS.
 *
 * Supports:
 *   - Full application deployment via Kustomize
 *   - Component-specific deployment (backend/frontend only)
 *   - S3 sync for manifest transfer
 *   - Bastion-based execution
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { CommandBuilder } from '../../../framework/command/CommandBuilder.js';
import type { SSMCommandRunner } from '../../aws/runtime/SSMCommandRunner.js';
import type { Logger } from '../../../framework/types.js';
import type { RunOptions } from '../../types.js';
import type { DeployResult } from './deployers-types.js';

/** Configuration for App Manifest deployment */
export interface AppDeployerConfig {
  /** EKS cluster name */
  clusterName: string;
  /** AWS region */
  region: string;
  /** S3 bucket for manifests */
  bucket: string;
  /** S3 prefix for app manifests */
  s3Prefix: string;
  /** Kustomize overlay name */
  overlay: string;
  /** kubectl version to install */
  kubectlVersion?: string;
  /** SSM runner for bastion-based deployments */
  bastionRunner?: SSMCommandRunner;
  /** Dry-run mode */
  dryRun?: boolean;
  /** Suppress output */
  silent?: boolean;
}

/** Dependencies for AppManifestDeployer */
export interface AppDeployerDependencies {
  run: (cmd: string, options?: RunOptions) => string | null;
  log: Logger;
}

const defaultDependencies: AppDeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/** Deployment component type */
export type DeployComponent = 'all' | 'backend' | 'frontend';

/**
 * Deployer for application manifests (Hono backend + frontend).
 *
 * @example
 * const deployer = new AppManifestDeployer({
 *   clusterName: 'my-cluster',
 *   region: 'ap-northeast-1',
 *   bucket: 'my-bucket',
 *   s3Prefix: 'k8s-manifests',
 *   overlay: 'prod',
 *   bastionRunner: ssmRunner,
 * });
 *
 * // Deploy all components
 * await deployer.deploy('all');
 *
 * // Deploy backend only
 * await deployer.deploy('backend');
 */
export class AppManifestDeployer {
  private config: AppDeployerConfig;
  private deps: AppDeployerDependencies;

  constructor(config: AppDeployerConfig, deps: Partial<AppDeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Deploy application manifests.
   *
   * @param component - Which component(s) to deploy
   * @returns Deployment result
   */
  async deploy(component: DeployComponent = 'all'): Promise<DeployResult> {
    const { dryRun } = this.config;

    if (dryRun && !this.config.silent) {
      this.deps.log.warn('Dry-run mode enabled');
    }

    // Component-specific deployment (skip full kustomize apply)
    if (component !== 'all') {
      return this.deployComponent(component);
    }

    return this.deployAll();
  }

  /**
   * Deploy all components via Kustomize.
   */
  private async deployAll(): Promise<DeployResult> {
    const {
      clusterName, region, bucket, s3Prefix, overlay, kubectlVersion = '1.29.0', dryRun,
    } = this.config;

    const kubectlApply = dryRun
      ? `kubectl apply -k /home/ec2-user/k8s/overlays/${overlay} --dry-run=client`
      : `kubectl apply -k /home/ec2-user/k8s/overlays/${overlay}`;

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.installKubectl(kubectlVersion),
      ['cd /home/ec2-user'],
      CommandBuilder.setupKubeconfig(region, clusterName),
      [
        // Sync manifests from S3
        `aws s3 sync s3://${bucket}/${s3Prefix}/ /home/ec2-user/k8s/ --region ${region}`,
        'chown -R ec2-user:ec2-user /home/ec2-user/k8s',
        // Apply manifests
        `sudo -u ec2-user ${kubectlApply}`,
        // Wait for rollouts
        'sudo -u ec2-user kubectl rollout status deployment/app-backend -n app --timeout=120s 2>/dev/null || echo "Backend rollout timeout"',
        'sudo -u ec2-user kubectl rollout status deployment/app-frontend -n app --timeout=120s 2>/dev/null || echo "Frontend rollout timeout"',
        // Show status
        'sudo -u ec2-user kubectl get pods -n app -o wide',
        'sudo -u ec2-user kubectl get svc -n app',
      ],
    ]);

    const result = await this.execute(cmds, 'App deployment');

    if (result.success && !this.config.silent) {
      this.deps.log.pass('App deployed');
    } else if (!result.success && !this.config.silent) {
      this.deps.log.fail(`Deployment ${result.error || 'failed'}`);
    }

    return result;
  }

  /**
   * Deploy a specific component only.
   */
  private async deployComponent(component: 'backend' | 'frontend'): Promise<DeployResult> {
    const {
      clusterName, region, bucket, s3Prefix, overlay, kubectlVersion = '1.29.0', dryRun,
    } = this.config;

    const deploymentName = component === 'backend' ? 'app-backend' : 'app-frontend';

    if (!this.config.silent) {
      this.deps.log.info(`Deploying ${component} only...`);
    }

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.installKubectl(kubectlVersion),
      ['cd /home/ec2-user'],
      CommandBuilder.setupKubeconfig(region, clusterName),
      [
        // Sync manifests
        `aws s3 sync s3://${bucket}/${s3Prefix}/ /home/ec2-user/k8s/ --region ${region}`,
        'chown -R ec2-user:ec2-user /home/ec2-user/k8s',
        '',
        // Apply full manifests first to ensure latest config
        dryRun
          ? `sudo -u ec2-user kubectl apply -k /home/ec2-user/k8s/overlays/${overlay} --dry-run=client`
          : `sudo -u ec2-user kubectl apply -k /home/ec2-user/k8s/overlays/${overlay}`,
        '',
        // Rollout restart specific component
        dryRun
          ? `echo "[dry-run] Would restart ${deploymentName}"`
          : `sudo -u ec2-user kubectl rollout restart deployment/${deploymentName} -n app`,
        '',
        // Wait for rollout
        dryRun
          ? `echo "[dry-run] Would wait for ${deploymentName}"`
          : `sudo -u ec2-user kubectl rollout status deployment/${deploymentName} -n app --timeout=120s`,
        '',
        // Show status
        `sudo -u ec2-user kubectl get pods -n app -l app.kubernetes.io/name=${deploymentName} -o wide`,
      ],
    ]);

    const result = await this.execute(cmds, `${component} deployment`);

    if (result.success && !this.config.silent) {
      this.deps.log.pass(`${component} deployed`);
    } else if (!result.success && !this.config.silent) {
      this.deps.log.fail(`${component} deployment ${result.error || 'failed'}`);
    }

    return result;
  }

  /**
   * Get deployment status.
   *
   * @returns Deployment result with status in output
   */
  async getStatus(): Promise<DeployResult> {
    const { clusterName, region, kubectlVersion = '1.29.0' } = this.config;

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.installKubectl(kubectlVersion),
      CommandBuilder.setupKubeconfig(region, clusterName),
      [
        'echo "=== Pods ==="; sudo -u ec2-user kubectl get pods -n app -o wide 2>/dev/null || echo "(none)"',
        'echo ""; echo "=== Services ==="; sudo -u ec2-user kubectl get svc -n app 2>/dev/null || echo "(none)"',
        'echo ""; echo "=== Deployments ==="; sudo -u ec2-user kubectl get deployments -n app 2>/dev/null || echo "(none)"',
      ],
    ]);

    return this.execute(cmds, 'App Status', true);
  }

  /**
   * Execute a command.
   */
  private async execute(cmd: string, label: string, silent = false): Promise<DeployResult> {
    const isSilent = silent || this.config.silent;

    try {
      if (this.config.bastionRunner) {
        const result = await this.config.bastionRunner.execute(cmd, {
          label,
          stream: !isSilent,
        });

        if (result.success) {
          return { success: true, output: result.output };
        } else {
          return { success: false, error: result.output };
        }
      } else {
        const output = this.deps.run(cmd, { ignoreError: true });

        if (output !== null) {
          return { success: true, output };
        } else {
          return { success: false, error: 'Command failed' };
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  }
}
