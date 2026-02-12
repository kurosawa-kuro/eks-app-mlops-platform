/**
 * BuildMLOps UseCase
 *
 * Handles local Docker build and push operations for MLOps:
 * - build: Build Docker image locally
 * - push: Build and push to ECR Public
 */

import { spawnSync } from 'child_process';
import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import { run } from '../../infrastructure/shell/index.js';

/**
 * Build command type.
 */
export type BuildCommand = 'build' | 'push';

/**
 * Input for BuildMLOps UseCase.
 */
export interface BuildMLOpsInput {
  /** Command to execute */
  command: BuildCommand;
  /** ECR URL */
  ecrUrl: string;
  /** Docker image tag */
  tag: string;
  /** Docker build platform */
  platform: string;
  /** Docker directory path */
  dockerDir: string;
  /** Context directory path */
  contextDir: string;
}

/**
 * Output from BuildMLOps UseCase.
 */
export interface BuildMLOpsOutput {
  /** Command executed */
  command: BuildCommand;
  /** Whether the command succeeded */
  commandSuccess: boolean;
  /** Full image URL with tag */
  imageUrl?: string;
}

/**
 * UseCase for building and pushing MLOps Docker images.
 */
export class BuildMLOps extends UseCase<BuildMLOpsInput, BuildMLOpsOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: BuildMLOpsInput): Promise<UseCaseResult<BuildMLOpsOutput>> {
    this.startTimer();

    try {
      let commandSuccess = false;
      const imageUrl = `${input.ecrUrl}:${input.tag}`;

      switch (input.command) {
        case 'build':
          await this.runPhase('action', 'Build', 'Building Docker image', async () => {
            commandSuccess = await this.buildImage(input, imageUrl);
          });
          break;

        case 'push':
          // First build
          await this.runPhase('action', 'Build', 'Building Docker image', async () => {
            commandSuccess = await this.buildImage(input, imageUrl);
          });

          if (commandSuccess) {
            // Then push
            await this.runPhase('action', 'Push', 'Pushing to ECR Public', async () => {
              commandSuccess = await this.pushImage(input, imageUrl);
            });
          }
          break;

        default:
          throw new Error(`Unknown command: ${input.command}`);
      }

      return this.buildResult({
        command: input.command,
        commandSuccess,
        imageUrl: commandSuccess ? imageUrl : undefined,
      });

    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }

  /**
   * Build Docker image.
   */
  private async buildImage(input: BuildMLOpsInput, imageUrl: string): Promise<boolean> {
    const log = defaultLog;
    const dockerfile = `${input.dockerDir}/Dockerfile`;

    log.info(`Dockerfile: ${dockerfile}`);
    log.info(`Context: ${input.contextDir}`);
    log.info(`Image: ${imageUrl}`);
    log.info(`Platform: ${input.platform}`);
    console.log('');

    const result = spawnSync('docker', [
      'build',
      '--platform', input.platform,
      '-t', imageUrl,
      '-f', dockerfile,
      input.contextDir,
    ], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      log.fail('Docker build failed');
      return false;
    }

    log.pass(`Built ${imageUrl}`);
    return true;
  }

  /**
   * Push image to ECR Public.
   */
  private async pushImage(input: BuildMLOpsInput, imageUrl: string): Promise<boolean> {
    const log = defaultLog;

    // Login to ECR Public
    log.info('Logging in to ECR Public...');
    const loginPassword = run('aws ecr-public get-login-password --region us-east-1', { silent: true });
    if (!loginPassword) {
      log.fail('Failed to get ECR login password');
      return false;
    }

    const loginResult = spawnSync('docker', ['login', '--username', 'AWS', '--password-stdin', 'public.ecr.aws'], {
      input: loginPassword,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (loginResult.status !== 0) {
      log.fail('Docker login failed');
      return false;
    }

    // Push
    log.info(`Pushing ${imageUrl}...`);
    const pushResult = spawnSync('docker', ['push', imageUrl], {
      stdio: 'inherit',
    });

    if (pushResult.status !== 0) {
      log.fail('Docker push failed');
      return false;
    }

    log.pass(`Pushed ${imageUrl}`);
    return true;
  }
}
