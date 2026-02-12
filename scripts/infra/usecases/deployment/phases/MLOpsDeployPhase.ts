/**
 * MLOpsDeployPhase - deploys MLOps resources and jobs via Bastion.
 */

import { MLOpsManifestDeployer } from '../../../infrastructure/kubernetes/deploy/MLOpsManifestDeployer.js';
import type { MLOpsPlaceholders, MLOpsJobConfig } from '../../../infrastructure/kubernetes/deploy/MLOpsManifestDeployer.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
  MLOpsDeployResult,
} from './types.js';

/** Options for MLOps deployment */
export interface MLOpsDeployOptions {
  /** S3 prefix for MLOps manifests */
  s3Prefix: string;
  /** Job configurations */
  jobs: Record<string, MLOpsJobConfig>;
  /** MLOps placeholder values */
  placeholders: MLOpsPlaceholders;
  /** Job timeout in seconds */
  jobTimeout?: number;
  /** Dry-run mode */
  dryRun?: boolean;
  /** Job to run */
  job?: string | null;
  /** Skip base resources, only run job */
  deployOnly?: boolean;
  /** Wait for job completion */
  wait?: boolean;
  /** kubectl version */
  kubectlVersion?: string;
}

/**
 * Phase that deploys MLOps resources and optionally runs a job.
 *
 * @example
 * const phase = new MLOpsDeployPhase({
 *   s3Prefix: 'mlops-manifests',
 *   jobs: { analytics: { k8sName: 'data-analytics', fileName: 'job-analytics.yaml' } },
 *   placeholders: { bucket: 's3-bucket', roleArn: 'arn:xxx', ecrUrl: null },
 * });
 * const result = await phase.execute(context);
 */
export class MLOpsDeployPhase implements ExecutableDeploymentPhase<MLOpsDeployResult> {
  readonly name = 'MLOps Deploy';
  readonly description = 'Deploy MLOps resources via Bastion';

  private options: MLOpsDeployOptions;

  constructor(options: MLOpsDeployOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<MLOpsDeployResult>> {
    const { clusterName, region, bucket, ssmRunner, log } = context;
    const {
      s3Prefix,
      jobs,
      placeholders,
      jobTimeout = 300,
      dryRun = false,
      job,
      deployOnly = false,
      wait = false,
      kubectlVersion = '1.29.0',
    } = this.options;

    if (!ssmRunner) {
      log.fail('SSM runner not available for MLOps deployment');
      return {
        success: false,
        error: 'SSM runner required for MLOps deployment',
      };
    }

    // Validate placeholders
    const deployer = new MLOpsManifestDeployer({
      clusterName,
      region,
      bucket,
      s3Prefix,
      jobs,
      jobTimeout,
      kubectlVersion,
      bastionRunner: ssmRunner,
      dryRun,
    });

    const validation = deployer.validatePlaceholders(placeholders);
    if (!validation.valid) {
      log.fail(validation.errors.join(', '));
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    try {
      const result = await deployer.deploy(placeholders, {
        dryRun,
        job,
        deployOnly,
        wait,
      });

      if (result.success) {
        return {
          success: true,
          data: {
            baseDeployed: !deployOnly,
            jobName: job || undefined,
            jobCompleted: job && wait ? true : undefined,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || 'MLOps deployment failed',
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.fail(`MLOps deployment failed: ${error}`);
      return {
        success: false,
        error,
      };
    }
  }
}
