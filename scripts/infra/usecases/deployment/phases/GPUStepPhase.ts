/**
 * GPUStepPhase - executes GPU/LLM deployment steps.
 */

import { GPUStackDeployer } from '../../../infrastructure/kubernetes/deploy/GPUStackDeployer.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
  GPUDeployResult,
  GPUStep,
} from './types.js';

/** Options for GPU deployment */
export interface GPUStepOptions {
  /** Step to execute */
  step: GPUStep;
  /** EKS cluster endpoint */
  clusterEndpoint: string;
  /** Karpenter IAM role ARN */
  karpenterRoleArn: string;
  /** Karpenter interruption queue name */
  karpenterQueueName: string;
  /** Karpenter version */
  karpenterVersion?: string;
  /** vLLM image */
  vllmImage?: string;
  /** LLM model ID */
  llmModel?: string;
  /** Wait time between step 4 and 5 in ms */
  waitBetweenSteps?: number;
}

/**
 * Phase that executes GPU/LLM deployment steps.
 *
 * @example
 * const phase = new GPUStepPhase({
 *   step: 'all',
 *   clusterEndpoint: 'https://...',
 *   karpenterRoleArn: 'arn:xxx',
 *   karpenterQueueName: 'queue-name',
 * });
 * const result = await phase.execute(context);
 */
export class GPUStepPhase implements ExecutableDeploymentPhase<GPUDeployResult> {
  readonly name = 'GPU Deploy';
  readonly description = 'Deploy GPU/LLM infrastructure';

  private options: GPUStepOptions;

  constructor(options: GPUStepOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<GPUDeployResult>> {
    const { clusterName, region, ssmRunner, log } = context;
    const {
      step,
      clusterEndpoint,
      karpenterRoleArn,
      karpenterQueueName,
      karpenterVersion = '1.1.0',
      vllmImage = 'vllm/vllm-openai:latest',
      llmModel = 'line-corporation/line-distilbert-base-japanese',
      waitBetweenSteps = 60000,
    } = this.options;

    if (!ssmRunner) {
      log.fail('SSM runner not available for GPU deployment');
      return {
        success: false,
        error: 'SSM runner required for GPU deployment',
      };
    }

    if (!clusterEndpoint || !karpenterRoleArn) {
      log.fail('Missing GPU deployment configuration');
      return {
        success: false,
        error: 'clusterEndpoint and karpenterRoleArn are required',
      };
    }

    try {
      const deployer = new GPUStackDeployer({
        clusterName,
        region,
        clusterEndpoint,
        karpenterRoleArn,
        karpenterQueueName,
        karpenterVersion,
        vllmImage,
        llmModel,
        bastionRunner: ssmRunner,
      });

      let success = true;
      const stepsExecuted: string[] = [];
      let karpenterInstalled = false;
      let llmDeployed = false;

      switch (step) {
        case '1':
          success = (await deployer.installKarpenter()).success;
          stepsExecuted.push('Karpenter');
          karpenterInstalled = success;
          break;

        case '2':
          success = (await deployer.deployNvidiaPlugin()).success;
          stepsExecuted.push('NVIDIA Plugin');
          break;

        case '3':
          success = (await deployer.deployGPUNodePool()).success;
          stepsExecuted.push('GPU NodePool');
          break;

        case '4':
          success = (await deployer.deployLLMStack()).success;
          stepsExecuted.push('LLM Stack');
          llmDeployed = success;
          break;

        case '5':
          success = (await deployer.redeployHono()).success;
          stepsExecuted.push('Hono Redeploy');
          break;

        case 'all':
          const result = await deployer.deployAll(waitBetweenSteps);
          success = result.success;
          stepsExecuted.push('Karpenter', 'NVIDIA Plugin', 'GPU NodePool', 'LLM Stack', 'Hono Redeploy');
          karpenterInstalled = success;
          llmDeployed = success;
          break;

        case 'status':
          await deployer.getStatus();
          stepsExecuted.push('Status');
          break;

        default:
          log.fail(`Unknown GPU step: ${step}`);
          return {
            success: false,
            error: `Unknown step: ${step}`,
          };
      }

      if (success) {
        return {
          success: true,
          data: {
            steps: stepsExecuted,
            karpenterInstalled,
            llmDeployed,
          },
        };
      } else {
        return {
          success: false,
          error: 'GPU deployment step failed',
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.fail(`GPU deployment failed: ${error}`);
      return {
        success: false,
        error,
      };
    }
  }
}
