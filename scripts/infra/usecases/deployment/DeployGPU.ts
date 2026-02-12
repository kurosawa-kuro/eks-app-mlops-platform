/**
 * DeployGPU UseCase
 *
 * Deploys GPU/LLM infrastructure to EKS.
 * Follows 起承転結 (ki-shō-ten-ketsu) narrative structure.
 */

import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import type { InfraContainer } from '../../container/types.js';
import { SSMCommandRunner } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { PreflightChecker } from '../../framework/lifecycle/PreflightChecker.js';
import { Overlay } from '../../domain/valueObjects/Overlay.js';
import { GPUStepPhase } from './phases/GPUStepPhase.js';
import type { DeploymentPhaseContext, GPUStep } from './phases/types.js';

/** Input for DeployGPU UseCase */
export interface DeployGPUInput {
  /** Step to execute */
  step: GPUStep;
}

/** Output from DeployGPU UseCase */
export interface DeployGPUOutput {
  /** Steps executed */
  steps: string[];
  /** Whether Karpenter was installed */
  karpenterInstalled: boolean;
  /** Whether LLM stack was deployed */
  llmDeployed: boolean;
  /** Bastion instance ID used */
  bastionId?: string;
}

/** Configuration for DeployGPU UseCase */
export interface DeployGPUConfig {
  /** AWS region */
  region: string;
  /** EKS cluster name */
  clusterName: string;
  /** EKS cluster endpoint */
  clusterEndpoint: string;
  /** Karpenter IAM role ARN */
  karpenterRoleArn: string;
  /** Karpenter interruption queue name */
  karpenterQueueName: string;
  /** Karpenter version */
  karpenterVersion: string;
  /** vLLM image */
  vllmImage: string;
  /** LLM model ID */
  llmModel: string;
  /** kubectl version */
  kubectlVersion: string;
  /** Bastion instance ID */
  bastionId?: string;
  /** Wait time between step 4 and 5 in ms */
  waitBetweenSteps?: number;
}

/**
 * UseCase for deploying GPU/LLM infrastructure to EKS.
 *
 * @example
 * const useCase = new DeployGPU(container, config);
 * const result = await useCase.execute({ step: 'all' });
 */
export class DeployGPU extends UseCase<DeployGPUInput, DeployGPUOutput> {
  private config: DeployGPUConfig;

  constructor(container: InfraContainer, config: DeployGPUConfig) {
    super(container);
    this.config = config;
  }

  async execute(input: DeployGPUInput): Promise<UseCaseResult<DeployGPUOutput>> {
    this.startTimer();

    const { step } = input;
    const {
      region, clusterName, clusterEndpoint, karpenterRoleArn, karpenterQueueName,
      karpenterVersion, vllmImage, llmModel, kubectlVersion, waitBetweenSteps = 60000,
    } = this.config;
    const bastionId = this.config.bastionId;

    const log = this.container.resolve('logger');

    // Handle help case
    if (step === 'status') {
      // Status is a special case - just show status without full phase tracking
    }

    try {
      // 起: Preflight Checks
      await this.runPhase('setup', 'Preflight', 'Running preflight checks', async () => {
        const preflight = new PreflightChecker();
        if (!preflight.checkAwsCli()) throw new Error('AWS CLI not found');
        if (!preflight.checkAwsCredentials()) throw new Error('AWS credentials not valid');
        if (!bastionId) throw new Error('Bastion instance ID not configured');
        if (!clusterEndpoint) throw new Error('Cluster endpoint not configured');
        if (!karpenterRoleArn) throw new Error('Karpenter role ARN not configured');
      });

      // Create SSM runner after preflight
      const ssmRunner = new SSMCommandRunner(bastionId!, region);

      // Create context
      const context: DeploymentPhaseContext = {
        region,
        clusterName,
        bucket: '', // Not used for GPU deployment
        bastionInstanceId: bastionId,
        ssmRunner,
        overlay: Overlay.create('prod'), // GPU doesn't use overlays
        log,
        kubectlVersion,
      };

      // 承転結: Execute GPU Steps
      let stepsExecuted: string[] = [];
      let karpenterInstalled = false;
      let llmDeployed = false;

      // Map step to description
      const stepDescriptions: Record<GPUStep, string> = {
        '1': 'Installing Karpenter',
        '2': 'Deploying NVIDIA Plugin',
        '3': 'Deploying GPU NodePool',
        '4': 'Deploying LLM Stack',
        '5': 'Redeploying Hono with LLM config',
        'all': 'Deploying all GPU infrastructure',
        'status': 'Showing GPU status',
      };

      const description = stepDescriptions[step] || `Step ${step}`;

      await this.runPhase(
        step === 'status' ? 'verification' : 'action',
        `GPU ${step}`,
        description,
        async () => {
          const phase = new GPUStepPhase({
            step,
            clusterEndpoint,
            karpenterRoleArn,
            karpenterQueueName,
            karpenterVersion,
            vllmImage,
            llmModel,
            waitBetweenSteps,
          });
          const result = await phase.execute(context);

          if (!result.success) {
            throw new Error(result.error);
          }

          if (result.data) {
            stepsExecuted = result.data.steps;
            karpenterInstalled = result.data.karpenterInstalled;
            llmDeployed = result.data.llmDeployed;
          }
        }
      );

      return this.buildResult({
        steps: stepsExecuted,
        karpenterInstalled,
        llmDeployed,
        bastionId,
      });
    } catch (error) {
      return this.buildFailedResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
