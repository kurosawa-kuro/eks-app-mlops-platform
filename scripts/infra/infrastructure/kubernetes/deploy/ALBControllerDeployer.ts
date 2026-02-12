/**
 * ALBControllerDeployer - deploys AWS Load Balancer Controller to EKS.
 *
 * Supports:
 *   - Installation check
 *   - Helm-based deployment
 *   - IRSA configuration
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { CommandBuilder } from '../../../framework/command/CommandBuilder.js';
import type { SSMCommandRunner } from '../../aws/runtime/SSMCommandRunner.js';
import type { Logger } from '../../../framework/types.js';
import type { RunOptions } from '../../types.js';
import type { DeployResult } from './deployers-types.js';

/** Configuration for ALB Controller deployment */
export interface ALBDeployerConfig {
  /** EKS cluster name */
  clusterName: string;
  /** AWS region */
  region: string;
  /** VPC ID */
  vpcId: string;
  /** IAM role ARN for IRSA */
  lbRoleArn: string;
  /** kubectl version to install */
  kubectlVersion?: string;
  /** SSM runner for bastion-based deployments */
  bastionRunner?: SSMCommandRunner;
  /** Suppress output */
  silent?: boolean;
}

/** Dependencies for ALBControllerDeployer */
export interface ALBDeployerDependencies {
  run: (cmd: string, options?: RunOptions) => string | null;
  log: Logger;
}

const defaultDependencies: ALBDeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/**
 * Deployer for AWS Load Balancer Controller.
 *
 * @example
 * const deployer = new ALBControllerDeployer({
 *   clusterName: 'my-cluster',
 *   region: 'ap-northeast-1',
 *   vpcId: 'vpc-xxx',
 *   lbRoleArn: 'arn:aws:iam::xxx:role/lb-controller',
 *   bastionRunner: ssmRunner,
 * });
 *
 * if (!await deployer.isInstalled()) {
 *   await deployer.install();
 * }
 */
export class ALBControllerDeployer {
  private config: ALBDeployerConfig;
  private deps: ALBDeployerDependencies;

  constructor(config: ALBDeployerConfig, deps: Partial<ALBDeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Check if ALB Controller is already installed.
   *
   * @returns True if installed
   */
  async isInstalled(): Promise<boolean> {
    const cmd = 'kubectl get deployment -n kube-system aws-load-balancer-controller >/dev/null 2>&1 && echo "INSTALLED" || echo "NOT_FOUND"';
    const result = await this.execute(cmd, 'Check ALB Controller', true);
    return result.success && result.output?.includes('INSTALLED') === true;
  }

  /**
   * Install AWS Load Balancer Controller.
   *
   * @returns Deployment result
   */
  async install(): Promise<DeployResult> {
    const { clusterName, region, vpcId, lbRoleArn, kubectlVersion = '1.29.0' } = this.config;

    if (!this.config.silent) {
      this.deps.log.info('Installing AWS Load Balancer Controller...');
    }

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.installKubectl(kubectlVersion),
      CommandBuilder.installHelm(),
      CommandBuilder.setupKubeconfig(region, clusterName),
      [
        // Check if already installed
        'if kubectl get deployment -n kube-system aws-load-balancer-controller >/dev/null 2>&1; then',
        '  echo "ALB Controller already installed"; exit 0; fi',
        // Add helm repo
        'helm repo add eks https://aws.github.io/eks-charts 2>/dev/null || true',
        'helm repo update',
        // Install ALB controller
        `helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system \\
          --set clusterName=${clusterName} --set serviceAccount.create=true \\
          --set serviceAccount.name=aws-load-balancer-controller \\
          --set serviceAccount.annotations."eks\\.amazonaws\\.com/role-arn"=${lbRoleArn} \\
          --set vpcId=${vpcId} --set region=${region}`,
        // Wait for rollout
        'kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=120s',
      ],
    ]);

    const result = await this.execute(cmds, 'ALB Controller');

    if (result.success && !this.config.silent) {
      this.deps.log.pass('ALB Controller setup complete');
    } else if (!result.success && !this.config.silent) {
      this.deps.log.fail('ALB Controller setup failed');
    }

    return result;
  }

  /**
   * Get ALB Controller status.
   *
   * @returns Deployment result with status in output
   */
  async getStatus(): Promise<DeployResult> {
    const cmd = 'kubectl get deployment -n kube-system aws-load-balancer-controller -o wide 2>/dev/null || echo "Not installed"';
    return this.execute(cmd, 'ALB Status');
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
          timeout: 180,
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
