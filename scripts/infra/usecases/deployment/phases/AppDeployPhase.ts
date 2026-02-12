/**
 * AppDeployPhase - deploys application manifests via Bastion.
 */

import { AppManifestDeployer } from '../../../infrastructure/kubernetes/deploy/AppManifestDeployer.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
  AppDeployResult,
} from './types.js';
import type { DeployComponent } from '../../../infrastructure/kubernetes/deploy/AppManifestDeployer.js';

/** Options for app deployment */
export interface AppDeployOptions {
  /** S3 prefix for app manifests */
  s3Prefix: string;
  /** Component to deploy */
  component: DeployComponent;
  /** Dry-run mode */
  dryRun?: boolean;
  /** kubectl version */
  kubectlVersion?: string;
}

/**
 * Phase that deploys application manifests (Hono backend + frontend).
 *
 * @example
 * const phase = new AppDeployPhase({
 *   s3Prefix: 'k8s-manifests',
 *   component: 'all',
 * });
 * const result = await phase.execute(context);
 */
export class AppDeployPhase implements ExecutableDeploymentPhase<AppDeployResult> {
  readonly name = 'App Deploy';
  readonly description = 'Deploy application via Bastion';

  private options: AppDeployOptions;

  constructor(options: AppDeployOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<AppDeployResult>> {
    const { clusterName, region, bucket, overlay, ssmRunner, log } = context;
    const { s3Prefix, component, dryRun = false, kubectlVersion = '1.29.0' } = this.options;

    if (!ssmRunner) {
      log.fail('SSM runner not available for app deployment');
      return {
        success: false,
        error: 'SSM runner required for app deployment',
      };
    }

    try {
      const deployer = new AppManifestDeployer({
        clusterName,
        region,
        bucket,
        s3Prefix,
        overlay: overlay.toString(),
        kubectlVersion,
        bastionRunner: ssmRunner,
        dryRun,
      });

      const result = await deployer.deploy(component);

      if (result.success) {
        const components = component === 'all'
          ? ['backend', 'frontend']
          : [component];

        return {
          success: true,
          data: {
            components,
            dryRun,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || 'App deployment failed',
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.fail(`App deployment failed: ${error}`);
      return {
        success: false,
        error,
      };
    }
  }
}
