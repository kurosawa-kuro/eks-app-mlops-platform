/**
 * DeployApp UseCase
 *
 * Deploys the application (Hono backend + frontend) to EKS.
 * Follows 起承転結 (ki-shō-ten-ketsu) narrative structure.
 */

import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import type { InfraContainer } from '../../container/types.js';
import { SSMCommandRunner } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { PreflightChecker } from '../../framework/lifecycle/PreflightChecker.js';
import { Overlay } from '../../domain/valueObjects/Overlay.js';
import { ManifestUploadPhase } from './phases/ManifestUploadPhase.js';
import { ALBSetupPhase } from './phases/ALBSetupPhase.js';
import { AppDeployPhase } from './phases/AppDeployPhase.js';
import { HTTPSVerifyPhase } from './phases/HTTPSVerifyPhase.js';
import type { DeploymentPhaseContext } from './phases/types.js';
import type { DeployComponent } from '../../infrastructure/kubernetes/deploy/AppManifestDeployer.js';
import type { DeployResult } from '../../infrastructure/kubernetes/deploy/deployers-types.js';

/** Input for DeployApp UseCase */
export interface DeployAppInput {
  /** Overlay to use */
  overlay: Overlay;
  /** Component to deploy */
  component: DeployComponent;
  /** Skip S3 upload */
  skipUpload: boolean;
  /** Dry-run mode */
  dryRun: boolean;
  /** Setup ALB Controller */
  setupAlb: boolean;
  /** Skip HTTPS verification */
  skipHttps: boolean;
  /** S3 bucket (optional, resolved from config if not provided) */
  bucket?: string;
  /** Bastion ID (optional, resolved from config if not provided) */
  bastionId?: string;
  /** ALB configuration (optional, resolved from config if not provided) */
  albConfig?: { lbRoleArn: string; vpcId: string };
  /** API URL for HTTPS verification (optional, resolved from config if not provided) */
  apiUrl?: string;
}

/** Output from DeployApp UseCase */
export interface DeployAppOutput {
  /** Deployed components */
  components: string[];
  /** Whether dry-run mode was used */
  dryRun: boolean;
  /** Bastion instance ID used */
  bastionId?: string;
}

/** Configuration for DeployApp UseCase */
export interface DeployAppConfig {
  /** AWS region */
  region: string;
  /** EKS cluster name */
  clusterName: string;
  /** S3 bucket for manifests */
  bucket: string;
  /** S3 prefix for app manifests */
  s3Prefix: string;
  /** Local K8s manifests directory */
  k8sDir: string;
  /** kubectl version */
  kubectlVersion: string;
  /** Bastion instance ID */
  bastionId?: string;
  /** ALB configuration */
  albConfig?: { lbRoleArn: string; vpcId: string };
  /** API URL for HTTPS verification */
  apiUrl?: string;
}

/**
 * UseCase for deploying the application to EKS.
 *
 * @example
 * const useCase = new DeployApp(container, config);
 * const result = await useCase.execute({
 *   overlay: new Overlay('prod'),
 *   component: 'all',
 *   skipUpload: false,
 *   dryRun: false,
 *   setupAlb: true,
 *   skipHttps: false,
 * });
 */
export class DeployApp extends UseCase<DeployAppInput, DeployAppOutput> {
  private config: DeployAppConfig;

  constructor(container: InfraContainer, config: DeployAppConfig) {
    super(container);
    this.config = config;
  }

  async execute(input: DeployAppInput): Promise<UseCaseResult<DeployAppOutput>> {
    this.startTimer();

    const { overlay, component, skipUpload, dryRun, setupAlb, skipHttps } = input;
    const { region, clusterName, bucket, s3Prefix, k8sDir, kubectlVersion } = this.config;
    const bastionId = input.bastionId || this.config.bastionId;
    const albConfig = input.albConfig || this.config.albConfig;
    const apiUrl = input.apiUrl || this.config.apiUrl;

    const log = this.container.resolve('logger');

    try {
      // 起: Preflight Checks
      await this.runPhase('setup', 'Preflight', 'Running preflight checks', async () => {
        const preflight = new PreflightChecker();
        if (!preflight.checkAwsCli()) throw new Error('AWS CLI not found');
        if (!preflight.checkAwsCredentials()) throw new Error('AWS credentials not valid');
        if (!bastionId) throw new Error('Bastion instance ID not configured');
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
        overlay,
        log,
        kubectlVersion,
      };

      await this.runPhase('action', 'Upload', 'Uploading manifests to S3', async () => {
        const phase = new ManifestUploadPhase({
          sourceDir: k8sDir,
          s3Prefix,
          skip: skipUpload,
        });
        const result = await phase.execute(context);
        if (!result.success) throw new Error(result.error);
      });

      // 転: Setup ALB Controller (optional)
      if (setupAlb && albConfig) {
        await this.runPhase('transition', 'ALB Setup', 'Installing ALB Controller', async () => {
          const phase = new ALBSetupPhase({
            vpcId: albConfig.vpcId,
            lbRoleArn: albConfig.lbRoleArn,
            kubectlVersion,
          });
          const result = await phase.execute(context);
          if (!result.success) throw new Error(result.error);
        });
      } else if (setupAlb) {
        this.skipPhase('transition', 'ALB Setup', 'Installing ALB Controller', 'ALB config not available');
      }

      // 転: Deploy Application
      await this.runPhase('transition', 'Deploy', 'Deploying application', async () => {
        const phase = new AppDeployPhase({
          s3Prefix,
          component,
          dryRun,
          kubectlVersion,
        });
        const result = await phase.execute(context);
        if (!result.success) throw new Error(result.error);
      });

      // 結: HTTPS Verification
      if (!dryRun && apiUrl && !skipHttps) {
        await this.runPhase('verification', 'HTTPS', 'Verifying HTTPS endpoint', async () => {
          const phase = new HTTPSVerifyPhase({ url: apiUrl });
          const result = await phase.execute(context);
          // Don't throw on HTTPS failure - just warn
          if (result.data && !result.data.passed) {
            log.warn('HTTPS verification failed - deployment may still be successful');
          }
        });
      } else {
        this.skipPhase('verification', 'HTTPS', 'Verifying HTTPS endpoint',
          dryRun ? 'Dry-run mode' : skipHttps ? 'Skipped by user' : 'No API URL');
      }

      return this.buildResult({
        components: component === 'all' ? ['backend', 'frontend'] : [component],
        dryRun,
        bastionId,
      });
    } catch (error) {
      return this.buildFailedResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
