/**
 * MLOpsManifestDeployer - deploys MLOps resources and jobs to EKS.
 *
 * Supports:
 *   - Base resources deployment (namespace, configmap, serviceaccount)
 *   - MLOps job deployment with placeholder substitution
 *   - Job wait and logging
 *   - Bastion-based execution
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import { CommandBuilder } from '../../../framework/command/CommandBuilder.js';
import { escapeSedReplacement } from '../../../framework/utils/validation.js';
import type { SSMCommandRunner } from '../../aws/runtime/SSMCommandRunner.js';
import type { Logger } from '../../../framework/types.js';
import type { RunOptions } from '../../types.js';
import type { DeployResult } from './deployers-types.js';

/** Job configuration mapping */
export interface MLOpsJobConfig {
  k8sName: string;
  fileName: string;
}

/** Configuration for MLOps deployment */
export interface MLOpsDeployerConfig {
  /** EKS cluster name */
  clusterName: string;
  /** AWS region */
  region: string;
  /** S3 bucket for manifests */
  bucket: string;
  /** S3 prefix for MLOps manifests */
  s3Prefix: string;
  /** Job configurations */
  jobs: Record<string, MLOpsJobConfig>;
  /** Job timeout in seconds */
  jobTimeout?: number;
  /** kubectl version to install */
  kubectlVersion?: string;
  /** SSM runner for bastion-based deployments */
  bastionRunner?: SSMCommandRunner;
  /** Dry-run mode */
  dryRun?: boolean;
  /** Suppress output */
  silent?: boolean;
}

/** MLOps config with placeholder values */
export interface MLOpsPlaceholders {
  /** S3 bucket name */
  bucket: string | null;
  /** Workload IAM role ARN */
  roleArn: string | null;
  /** ECR MLOps image URL */
  ecrUrl: string | null;
}

/** Dependencies for MLOpsManifestDeployer */
export interface MLOpsDeployerDependencies {
  run: (cmd: string, options?: RunOptions) => string | null;
  log: Logger;
}

const defaultDependencies: MLOpsDeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/** Options for MLOps deployment */
export interface MLOpsDeployOptions {
  /** Deploy in dry-run mode */
  dryRun?: boolean;
  /** Job name to run (null for base only) */
  job?: string | null;
  /** Skip base resources, only run job */
  deployOnly?: boolean;
  /** Wait for job completion */
  wait?: boolean;
}

/**
 * Deployer for MLOps resources and jobs.
 *
 * @example
 * const deployer = new MLOpsManifestDeployer({
 *   clusterName: 'my-cluster',
 *   region: 'ap-northeast-1',
 *   bucket: 'my-bucket',
 *   s3Prefix: 'mlops-manifests',
 *   jobs: {
 *     analytics: { k8sName: 'data-analytics', fileName: 'job-analytics.yaml' },
 *   },
 *   bastionRunner: ssmRunner,
 * });
 *
 * // Deploy base resources
 * await deployer.deploy(placeholders, {});
 *
 * // Deploy and run analytics job
 * await deployer.deploy(placeholders, { job: 'analytics', wait: true });
 */
export class MLOpsManifestDeployer {
  private config: MLOpsDeployerConfig;
  private deps: MLOpsDeployerDependencies;

  constructor(config: MLOpsDeployerConfig, deps: Partial<MLOpsDeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Validate MLOps placeholders.
   *
   * @param placeholders - Placeholder values
   * @returns Validation result
   */
  validatePlaceholders(placeholders: MLOpsPlaceholders): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!placeholders.bucket) errors.push('S3 bucket not configured');
    if (!placeholders.roleArn) errors.push('Workload role ARN not configured');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Deploy MLOps resources and optionally run a job.
   *
   * @param placeholders - Placeholder values for template substitution
   * @param options - Deployment options
   * @returns Deployment result
   */
  async deploy(placeholders: MLOpsPlaceholders, options: MLOpsDeployOptions = {}): Promise<DeployResult> {
    const { dryRun, job, deployOnly, wait } = options;

    if (dryRun && !this.config.silent) {
      this.deps.log.warn('Dry-run mode enabled');
    }

    const {
      clusterName, region, bucket, s3Prefix, kubectlVersion = '1.29.0', jobTimeout = 300,
    } = this.config;

    const placeholderMap = {
      PLACEHOLDER_BUCKET_NAME: placeholders.bucket,
      PLACEHOLDER_ROLE_ARN: placeholders.roleArn,
      PLACEHOLDER_ECR_URL: placeholders.ecrUrl,
    };

    const sections: string[][] = [
      CommandBuilder.preamble(),
      CommandBuilder.installKubectl(kubectlVersion),
      ['cd /home/ec2-user'],
      CommandBuilder.setupKubeconfig(region, clusterName),
      [
        `aws s3 sync s3://${bucket}/${s3Prefix}/ /home/ec2-user/mlops-k8s/ --region ${region}`,
        'chown -R ec2-user:ec2-user /home/ec2-user/mlops-k8s',
      ],
    ];

    // Deploy base resources (namespace, configmap, serviceaccount)
    if (!deployOnly) {
      const nsApply = dryRun
        ? 'kubectl apply -f /home/ec2-user/mlops-k8s/namespace-mlops.yaml --dry-run=client'
        : 'kubectl apply -f /home/ec2-user/mlops-k8s/namespace-mlops.yaml';
      sections.push([`sudo -u ec2-user ${nsApply}`]);
      sections.push(this.applyWithReplace('/home/ec2-user/mlops-k8s/configmap.yaml', placeholderMap, dryRun));
      sections.push(this.applyWithReplace('/home/ec2-user/mlops-k8s/serviceaccount.yaml', placeholderMap, dryRun));
    }

    // Deploy job if specified
    if (job) {
      const jobConfig = this.config.jobs[job];
      if (!jobConfig) {
        return { success: false, error: `Unknown job: ${job}` };
      }

      const jobFile = `/home/ec2-user/mlops-k8s/${jobConfig.fileName}`;
      const k8sJobName = jobConfig.k8sName;

      // Delete existing job and apply new one
      sections.push([`sudo -u ec2-user kubectl delete job ${k8sJobName} -n mlops --ignore-not-found`]);
      sections.push(this.applyWithReplace(jobFile, placeholderMap, dryRun));

      // Wait for job completion if requested
      if (wait && !dryRun) {
        sections.push([
          `sudo -u ec2-user kubectl wait --for=condition=complete job/${k8sJobName} -n mlops --timeout=${jobTimeout}s || echo "Timeout"`,
          `sudo -u ec2-user kubectl logs -l stage=${job} -n mlops --tail=50 2>/dev/null || true`,
        ]);
      }
    }

    // Show status
    sections.push(['sudo -u ec2-user kubectl get all -n mlops 2>/dev/null || echo "No resources"']);

    const timeout = (job && wait) ? jobTimeout + 120 : 180;
    const result = await this.execute(CommandBuilder.join(sections), 'MLOps', timeout);

    if (result.success && !this.config.silent) {
      this.deps.log.pass('MLOps deployed');
    } else if (!result.success && !this.config.silent) {
      this.deps.log.fail(`MLOps ${result.error || 'failed'}`);
    }

    return result;
  }

  /**
   * Get MLOps status.
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
        'echo "=== MLOps Namespace ==="; sudo -u ec2-user kubectl get all -n mlops 2>/dev/null || echo "(none)"',
        'echo ""; echo "=== Jobs ==="; sudo -u ec2-user kubectl get jobs -n mlops 2>/dev/null || echo "(none)"',
      ],
    ]);

    return this.execute(cmds, 'MLOps Status', 60, true);
  }

  /**
   * Generate sed + kubectl apply commands for a file with placeholder replacement.
   */
  private applyWithReplace(
    filePath: string,
    placeholders: Record<string, string | null>,
    dryRun?: boolean
  ): string[] {
    // Escape replacement values to prevent sed command injection
    const sed = Object.entries(placeholders)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `sed -i 's#${k}#${escapeSedReplacement(v)}#g' ${filePath}`)
      .join(' && ');

    const apply = dryRun
      ? `kubectl apply -f ${filePath} --dry-run=client`
      : `kubectl apply -f ${filePath}`;

    return [sed, `sudo -u ec2-user ${apply}`];
  }

  /**
   * Execute a command.
   */
  private async execute(cmd: string, label: string, timeout = 180, silent = false): Promise<DeployResult> {
    const isSilent = silent || this.config.silent;

    try {
      if (this.config.bastionRunner) {
        const result = await this.config.bastionRunner.execute(cmd, {
          label,
          timeout,
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
