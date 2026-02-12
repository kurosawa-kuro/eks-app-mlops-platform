/**
 * ALBSetupPhase - installs AWS Load Balancer Controller.
 */

import { ALBControllerDeployer } from '../../../infrastructure/kubernetes/deploy/ALBControllerDeployer.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
} from './types.js';

/** Options for ALB setup */
export interface ALBSetupOptions {
  /** VPC ID */
  vpcId: string;
  /** IAM role ARN for IRSA */
  lbRoleArn: string;
  /** kubectl version */
  kubectlVersion?: string;
  /** Skip ALB setup */
  skip?: boolean;
}

/** ALB setup result */
export interface ALBSetupResult {
  /** Whether ALB Controller was installed */
  installed: boolean;
  /** Whether it was already installed */
  alreadyInstalled: boolean;
}

/**
 * Phase that installs AWS Load Balancer Controller.
 *
 * @example
 * const phase = new ALBSetupPhase({
 *   vpcId: 'vpc-xxx',
 *   lbRoleArn: 'arn:aws:iam::xxx:role/lb-controller',
 * });
 * const result = await phase.execute(context);
 */
export class ALBSetupPhase implements ExecutableDeploymentPhase<ALBSetupResult> {
  readonly name = 'ALB Setup';
  readonly description = 'Install AWS Load Balancer Controller';

  private options: ALBSetupOptions;

  constructor(options: ALBSetupOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<ALBSetupResult>> {
    const { clusterName, region, ssmRunner, log } = context;
    const { vpcId, lbRoleArn, kubectlVersion = '1.29.0', skip } = this.options;

    // Skip if requested
    if (skip) {
      return {
        success: true,
        data: { installed: false, alreadyInstalled: false },
        skipped: true,
        skipReason: 'ALB setup skipped by user',
      };
    }

    if (!ssmRunner) {
      log.fail('SSM runner not available for ALB setup');
      return {
        success: false,
        error: 'SSM runner required for ALB setup',
      };
    }

    try {
      const deployer = new ALBControllerDeployer({
        clusterName,
        region,
        vpcId,
        lbRoleArn,
        kubectlVersion,
        bastionRunner: ssmRunner,
      });

      // Check if already installed
      const isInstalled = await deployer.isInstalled();
      if (isInstalled) {
        log.pass('ALB Controller already installed');
        return {
          success: true,
          data: { installed: true, alreadyInstalled: true },
        };
      }

      // Install ALB Controller
      const result = await deployer.install();

      if (result.success) {
        return {
          success: true,
          data: { installed: true, alreadyInstalled: false },
        };
      } else {
        return {
          success: false,
          error: result.error || 'ALB Controller installation failed',
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.fail(`ALB setup failed: ${error}`);
      return {
        success: false,
        error,
      };
    }
  }
}
