#!/usr/bin/env npx tsx
/**
 * MLOps Management CLI
 *
 * Thin CLI wrapper for MLOps pipeline operations on EKS.
 *
 * Usage:
 *   npx tsx manage.ts build              # Build Docker image
 *   npx tsx manage.ts push               # Build and push to ECR
 *   npx tsx manage.ts deploy             # Deploy K8s resources
 *   npx tsx manage.ts job <name>         # Run specific job
 *   npx tsx manage.ts logs <stage>       # Show job logs
 *   npx tsx manage.ts pipeline           # Run full E2E pipeline
 *   npx tsx manage.ts status             # Show pods/jobs/S3 status
 *   npx tsx manage.ts verify             # Verify S3 contents
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { createConfig, DEFAULT_TF_DIR } from '../../config/index.js';
import { ManageMLOps, MLOPS_JOBS, type MLOpsCommand } from '../../usecases/mlops/ManageMLOps.js';
import { BuildMLOps, type BuildCommand } from '../../usecases/mlops/BuildMLOps.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, c } = lib;

/**
 * MLOps Management Command
 */
class MLOpsManageCLI extends InfraCommand {
  static override name = 'mlops-manage';
  static override description = 'MLOps Pipeline Management Tool';

  static override commands: Record<string, CommandDefinition> = {
    // Docker
    build: { desc: 'Build Docker image', aliases: ['b'] },
    push: { desc: 'Build and push to ECR Public', aliases: ['p'] },

    // Deploy
    deploy: { desc: 'Deploy K8s resources (namespace, configmap, serviceaccount)', aliases: ['d'], requireAws: true },

    // Jobs
    job: { desc: 'Run specific job', args: '<name>', aliases: ['j', 'run'], requireAws: true },
    logs: { desc: 'Show job logs (last 100 lines)', args: '<stage>', aliases: ['l'], requireAws: true },
    wait: { desc: 'Wait for job completion', args: '<name>', aliases: ['w'], requireAws: true },

    // Pipeline
    pipeline: { desc: 'Run full E2E pipeline', aliases: ['e2e'], requireAws: true },
    'pipeline-analytics': { desc: 'Run analytics+sentiment pipeline', aliases: ['e2e-analytics'], requireAws: true },

    // Status
    status: { desc: 'Show pods, jobs, S3 status', aliases: ['st', 's'], requireAws: true },
    verify: { desc: 'Verify S3 contents', aliases: ['v'], requireAws: true },
    metrics: { desc: 'Show model metrics', aliases: ['m'], requireAws: true },
    results: { desc: 'Show analytics/sentiment results', args: '[type]', aliases: ['r'], requireAws: true },

    // Cleanup
    clean: { desc: 'Delete all jobs', aliases: ['c'], requireAws: true },
    'clean-all': { desc: 'Delete all MLOps resources', requireAws: true },

    // Info
    info: { desc: 'Show configuration', aliases: ['i'], requireAws: true },

    // Smoke test
    smoke: { desc: 'Run MLOps smoke test (IRSA/S3 verification)', requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--tf-dir': { name: 'tfDir', type: 'string', desc: 'Terraform directory' },
    '--wait': { name: 'wait', type: 'boolean', desc: 'Wait for job completion' },
    '--timeout': { name: 'timeout', type: 'string', desc: 'Job timeout in seconds (default: 300)' },
    '--tag': { name: 'tag', type: 'string', desc: 'Docker image tag (default: latest)' },
    '--platform': { name: 'platform', type: 'string', desc: 'Docker build platform (default: linux/amd64)' },
    '--strict': { name: 'strict', type: 'boolean', desc: 'Exit 1 on failure (CI mode)' },
  };

  private getMLOpsConfig() {
    const tfDir = (this.options.tfDir as string) || DEFAULT_TF_DIR;
    const sharedConfig = createConfig(tfDir);

    return {
      s3Bucket: sharedConfig.s3Bucket || 'k8s-ml-platform-prod-data-<AWS_ACCOUNT_ID>',
      roleArn: sharedConfig.workloadRoleArn || 'arn:aws:iam::<AWS_ACCOUNT_ID>:role/k8s-ml-platform-prod-workload-role',
      ecrUrl: sharedConfig.ecrMlopsUrl || 'public.ecr.aws/s0n1j8n3/mlops-pipeline',
      clusterName: sharedConfig.clusterName || 'prod-eks-cluster',
      bastionId: sharedConfig.bastionInstanceId || '',
      k8sDir: path.resolve(__dirname, '../../../../mlops/k8s'),
      mlopsDir: path.resolve(__dirname, '../../../../mlops'),
      dockerDir: path.resolve(__dirname, '../../../../mlops/docker'),
    };
  }

  private async runManageCommand(command: MLOpsCommand, extra?: Partial<{ jobName: string; stage: string; timeout: number; resultType: string }>): Promise<number> {
    const config = this.getMLOpsConfig();

    if (!config.bastionId) {
      log.fail('Bastion instance ID not found. Run terraform apply first.');
      return 1;
    }

    const container = createInfraContainer(config.k8sDir);
    const useCase = new ManageMLOps(container);

    const result = await useCase.execute({
      command,
      region: this.region,
      clusterName: config.clusterName,
      bastionId: config.bastionId,
      s3Bucket: config.s3Bucket,
      roleArn: config.roleArn,
      ecrUrl: config.ecrUrl,
      k8sDir: config.k8sDir,
      ...extra,
    });

    if (!result.success) {
      log.fail(result.error?.message || `Command '${command}' failed`);
      return 1;
    }

    return result.data?.commandSuccess ? 0 : 1;
  }

  private async runBuildCommand(command: BuildCommand): Promise<number> {
    const config = this.getMLOpsConfig();
    const tag = (this.options.tag as string) || 'latest';
    const platform = (this.options.platform as string) || 'linux/amd64';

    const container = createInfraContainer(config.k8sDir);
    const useCase = new BuildMLOps(container);

    const result = await useCase.execute({
      command,
      ecrUrl: config.ecrUrl,
      tag,
      platform,
      dockerDir: config.dockerDir,
      contextDir: config.mlopsDir,
    });

    if (!result.success) {
      log.fail(result.error?.message || `Command '${command}' failed`);
      return 1;
    }

    return result.data?.commandSuccess ? 0 : 1;
  }

  // Docker commands
  async cmdBuild(): Promise<number> {
    return this.runBuildCommand('build');
  }

  async cmdPush(): Promise<number> {
    return this.runBuildCommand('push');
  }

  // Deploy
  async cmdDeploy(): Promise<number> {
    return this.runManageCommand('deploy');
  }

  // Job commands
  async cmdJob(name?: string): Promise<number> {
    const jobName = name || this.args[0];
    if (!jobName) {
      log.fail('Usage: manage.ts job <name>');
      log.info(`Available jobs: ${Object.keys(MLOPS_JOBS).join(', ')}`);
      return 1;
    }

    const result = await this.runManageCommand('job', { jobName });

    // Wait if requested
    if (result === 0 && this.options.wait) {
      const timeout = parseInt(this.options.timeout as string) || undefined;
      return this.runManageCommand('wait', { jobName, timeout });
    }

    return result;
  }

  async cmdWait(name?: string): Promise<number> {
    const jobName = name || this.args[0];
    if (!jobName) {
      log.fail('Usage: manage.ts wait <name>');
      return 1;
    }
    const timeout = parseInt(this.options.timeout as string) || undefined;
    return this.runManageCommand('wait', { jobName, timeout });
  }

  async cmdLogs(stage?: string): Promise<number> {
    const stageArg = stage || this.args[0];
    if (!stageArg) {
      log.fail('Usage: manage.ts logs <stage>');
      log.info(`Available stages: ${Object.values(MLOPS_JOBS).map(j => j.stage).join(', ')}`);
      return 1;
    }
    return this.runManageCommand('logs', { stage: stageArg });
  }

  // Pipeline commands
  async cmdPipeline(): Promise<number> {
    return this.runManageCommand('pipeline');
  }

  async cmdPipelineAnalytics(): Promise<number> {
    return this.runManageCommand('pipeline-analytics');
  }

  // Status commands
  async cmdStatus(): Promise<number> {
    return this.runManageCommand('status');
  }

  async cmdVerify(): Promise<number> {
    return this.runManageCommand('verify');
  }

  async cmdMetrics(): Promise<number> {
    return this.runManageCommand('metrics');
  }

  async cmdResults(type?: string): Promise<number> {
    const resultType = type || this.args[0] || 'analytics';
    return this.runManageCommand('results', { resultType });
  }

  // Cleanup commands
  async cmdClean(): Promise<number> {
    return this.runManageCommand('clean');
  }

  async cmdCleanAll(): Promise<number> {
    return this.runManageCommand('clean-all');
  }

  // Info command
  async cmdInfo(): Promise<number> {
    return this.runManageCommand('info');
  }

  // Smoke test command
  async cmdSmoke(): Promise<number> {
    const strict = this.options.strict === true;
    const result = await this.runManageCommand('smoke');

    if (strict && result !== 0) {
      log.fail('Smoke test failed (strict mode)');
      return 1;
    }

    return result;
  }
}

MLOpsManageCLI.main();
