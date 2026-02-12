/**
 * DeployMLOps UseCase
 *
 * Deploys MLOps resources and runs data pipeline jobs on EKS.
 * Follows 起承転結 (ki-shō-ten-ketsu) narrative structure.
 */

import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import type { InfraContainer } from '../../container/types.js';
import { SSMCommandRunner } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { PreflightChecker } from '../../framework/lifecycle/PreflightChecker.js';
import { aws } from '../../infrastructure/shell/index.js';
import { Overlay } from '../../domain/valueObjects/Overlay.js';
import { ManifestUploadPhase } from './phases/ManifestUploadPhase.js';
import { MLOpsDeployPhase } from './phases/MLOpsDeployPhase.js';
import type { DeploymentPhaseContext, MLOpsJobConfig } from './phases/types.js';
import type { MLOpsPlaceholders } from '../../infrastructure/kubernetes/deploy/MLOpsManifestDeployer.js';

/** Input for DeployMLOps UseCase */
export interface DeployMLOpsInput {
  /** Skip S3 upload */
  skipUpload: boolean;
  /** Dry-run mode */
  dryRun: boolean;
  /** Job to run */
  job?: string | null;
  /** Skip base resources, only run job */
  deployOnly: boolean;
  /** Wait for job completion */
  waitJob: boolean;
}

/** Output from DeployMLOps UseCase */
export interface DeployMLOpsOutput {
  /** Whether base resources were deployed */
  baseDeployed: boolean;
  /** Job name if a job was run */
  jobName?: string;
  /** Whether job completed successfully */
  jobCompleted?: boolean;
  /** Bastion instance ID used */
  bastionId?: string;
}

/** Configuration for DeployMLOps UseCase */
export interface DeployMLOpsConfig {
  /** AWS region */
  region: string;
  /** EKS cluster name */
  clusterName: string;
  /** S3 bucket for manifests */
  bucket: string;
  /** S3 prefix for MLOps manifests */
  s3Prefix: string;
  /** Local MLOps K8s directory */
  k8sDir: string;
  /** Namespace file path */
  namespaceFile: string;
  /** Job configurations */
  jobs: Record<string, MLOpsJobConfig>;
  /** Job timeout in seconds */
  jobTimeout: number;
  /** kubectl version */
  kubectlVersion: string;
  /** Bastion instance ID */
  bastionId?: string;
  /** MLOps placeholder values */
  placeholders: MLOpsPlaceholders;
}

/**
 * UseCase for deploying MLOps resources to EKS.
 *
 * @example
 * const useCase = new DeployMLOps(container, config);
 * const result = await useCase.execute({
 *   skipUpload: false,
 *   dryRun: false,
 *   job: 'analytics',
 *   deployOnly: false,
 *   waitJob: true,
 * });
 */
export class DeployMLOps extends UseCase<DeployMLOpsInput, DeployMLOpsOutput> {
  private config: DeployMLOpsConfig;

  constructor(container: InfraContainer, config: DeployMLOpsConfig) {
    super(container);
    this.config = config;
  }

  async execute(input: DeployMLOpsInput): Promise<UseCaseResult<DeployMLOpsOutput>> {
    this.startTimer();

    const { skipUpload, dryRun, job, deployOnly, waitJob } = input;
    const {
      region, clusterName, bucket, s3Prefix, k8sDir, namespaceFile,
      jobs, jobTimeout, kubectlVersion, placeholders,
    } = this.config;
    const bastionId = this.config.bastionId;

    const log = this.container.resolve('logger');

    // Validate job name if provided
    if (job && !jobs[job]) {
      const validJobs = Object.keys(jobs).join(', ');
      return this.buildFailedResult(new Error(`Invalid job: ${job}. Valid: ${validJobs}`));
    }

    try {
      // 起: Preflight Checks
      await this.runPhase('setup', 'Preflight', 'Running preflight checks', async () => {
        const preflight = new PreflightChecker();
        if (!preflight.checkAwsCli()) throw new Error('AWS CLI not found');
        if (!preflight.checkAwsCredentials()) throw new Error('AWS credentials not valid');
        if (!bastionId) throw new Error('Bastion instance ID not configured');

        // Validate placeholders
        if (!placeholders.bucket) throw new Error('S3 bucket not configured in placeholders');
        if (!placeholders.roleArn) throw new Error('Workload role ARN not configured in placeholders');
      });

      // Create SSM runner after preflight
      const ssmRunner = new SSMCommandRunner(bastionId!, region);

      // Check Bastion SSM connectivity
      await this.runPhase('setup', 'Bastion', 'Checking Bastion SSM connectivity', async () => {
        const status = ssmRunner.getStatus();
        if (status !== 'Online') {
          throw new Error(`Bastion offline: ${status}`);
        }
        log.pass('Bastion SSM: Online');
      });

      // 承: Upload Manifests
      const context: DeploymentPhaseContext = {
        region,
        clusterName,
        bucket,
        bastionInstanceId: bastionId,
        ssmRunner,
        overlay: Overlay.create('prod'), // MLOps doesn't use overlays
        log,
        kubectlVersion,
      };

      await this.runPhase('action', 'Upload', 'Uploading MLOps manifests to S3', async () => {
        if (skipUpload) {
          log.warn('Skipping S3 upload');
          return;
        }

        // Sync main directory
        aws(`s3 sync ${k8sDir} s3://${bucket}/${s3Prefix}/ --delete`);
        // Copy namespace file
        aws(`s3 cp ${namespaceFile} s3://${bucket}/${s3Prefix}/namespace-mlops.yaml`);
        log.pass('MLOps manifests uploaded');
      });

      // 転: Deploy MLOps Resources
      await this.runPhase('transition', 'Deploy', 'Deploying MLOps resources', async () => {
        const phase = new MLOpsDeployPhase({
          s3Prefix,
          jobs,
          placeholders,
          jobTimeout,
          dryRun,
          job,
          deployOnly,
          wait: waitJob,
          kubectlVersion,
        });
        const result = await phase.execute(context);
        if (!result.success) throw new Error(result.error);
      });

      // 結: Summary (no verification needed for MLOps)
      this.skipPhase('verification', 'Summary', 'Displaying summary', 'No verification needed');

      return this.buildResult({
        baseDeployed: !deployOnly,
        jobName: job || undefined,
        jobCompleted: job && waitJob ? true : undefined,
        bastionId,
      });
    } catch (error) {
      return this.buildFailedResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
