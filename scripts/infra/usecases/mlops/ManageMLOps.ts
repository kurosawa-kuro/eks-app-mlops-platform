/**
 * ManageMLOps UseCase
 *
 * Manages MLOps pipeline operations on EKS via bastion host:
 * - deploy: Deploy K8s resources (namespace, configmap, serviceaccount)
 * - job: Run specific MLOps job
 * - wait: Wait for job completion
 * - logs: Show job logs
 * - pipeline: Run full E2E pipeline
 * - pipeline-analytics: Run analytics+sentiment pipeline
 * - status: Show pods/jobs/S3 status
 * - verify: Verify S3 contents
 * - metrics: Show model metrics
 * - results: Show analytics/sentiment results
 * - clean: Delete all jobs
 * - clean-all: Delete all MLOps resources
 * - info: Show configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import { aws } from '../../infrastructure/shell/index.js';
import { SSMCommandRunner } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { CommandBuilder } from '../../framework/command/CommandBuilder.js';

/**
 * MLOps command type.
 */
export type MLOpsCommand =
  | 'deploy' | 'job' | 'wait' | 'logs'
  | 'pipeline' | 'pipeline-analytics'
  | 'status' | 'verify' | 'metrics' | 'results'
  | 'clean' | 'clean-all' | 'info'
  | 'smoke';

/**
 * Job configuration.
 */
export interface JobConfig {
  k8sName: string;
  fileName: string;
  stage: string;
}

/**
 * Default job configurations.
 */
export const MLOPS_JOBS: Record<string, JobConfig> = {
  preprocess: { k8sName: 'data-preprocess', fileName: 'job-preprocess.yaml', stage: 'preprocess' },
  train: { k8sName: 'model-train', fileName: 'job-train.yaml', stage: 'train' },
  analytics: { k8sName: 'data-analytics', fileName: 'job-analytics.yaml', stage: 'analytics' },
  sentiment: { k8sName: 'sentiment-analysis', fileName: 'job-sentiment.yaml', stage: 'sentiment' },
  generate: { k8sName: 'data-generate', fileName: 'job-generate.yaml', stage: 'generate' },
  'generate-reviews': { k8sName: 'generate-reviews', fileName: 'job-generate-reviews.yaml', stage: 'generate-reviews' },
  smoke: { k8sName: 'mlops-smoke', fileName: 'job-smoke.yaml', stage: 'smoke' },
};

/**
 * Step-specific timeouts (in seconds).
 */
export const STEP_TIMEOUTS: Record<string, number> = {
  generate: 120,
  'generate-reviews': 120,
  preprocess: 180,
  train: 300,
  analytics: 300,
  sentiment: 600,
  smoke: 60,
};

/**
 * Input for MLOps management.
 */
export interface ManageMLOpsInput {
  /** Command to execute */
  command: MLOpsCommand;
  /** AWS region */
  region: string;
  /** EKS cluster name */
  clusterName: string;
  /** Bastion instance ID */
  bastionId: string;
  /** S3 bucket for data */
  s3Bucket: string;
  /** IRSA role ARN */
  roleArn: string;
  /** ECR URL for MLOps image */
  ecrUrl: string;
  /** K8s directory path */
  k8sDir: string;
  /** Job name (for job/wait commands) */
  jobName?: string;
  /** Stage name (for logs command) */
  stage?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Result type (for results command) */
  resultType?: string;
}

/**
 * Output from MLOps management.
 */
export interface ManageMLOpsOutput {
  /** Command executed */
  command: MLOpsCommand;
  /** Whether the command succeeded */
  commandSuccess: boolean;
  /** Output from command */
  output?: string;
  /** Job status (for job commands) */
  jobStatus?: { name: string; completed: boolean };
}

/**
 * Manages MLOps operations via SSM commands.
 */
export class ManageMLOps extends UseCase<ManageMLOpsInput, ManageMLOpsOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: ManageMLOpsInput): Promise<UseCaseResult<ManageMLOpsOutput>> {
    this.startTimer();
    const log = defaultLog;

    try {
      const ssmRunner = new SSMCommandRunner(input.bastionId, input.region);
      let commandSuccess = false;
      let output: string | undefined;
      let jobStatus: { name: string; completed: boolean } | undefined;

      switch (input.command) {
        case 'deploy':
          await this.runPhase('action', 'Deploy', 'Deploying MLOps resources', async () => {
            commandSuccess = await this.deployResources(ssmRunner, input);
          });
          break;

        case 'job':
          await this.runPhase('action', 'Job', `Running job ${input.jobName}`, async () => {
            const result = await this.runJob(ssmRunner, input);
            commandSuccess = result.success;
            jobStatus = result.jobStatus;
          });
          break;

        case 'wait':
          await this.runPhase('transition', 'Wait', `Waiting for job ${input.jobName}`, async () => {
            commandSuccess = await this.waitJob(ssmRunner, input);
          });
          break;

        case 'logs':
          await this.runPhase('setup', 'Logs', `Showing logs for ${input.stage}`, async () => {
            const result = await this.showLogs(ssmRunner, input);
            commandSuccess = result.success;
            output = result.output;
          });
          break;

        case 'pipeline':
          await this.runPhase('action', 'Pipeline', 'Running full E2E pipeline', async () => {
            commandSuccess = await this.runPipeline(ssmRunner, input, 'full');
          });
          break;

        case 'pipeline-analytics':
          await this.runPhase('action', 'Pipeline', 'Running analytics+sentiment pipeline', async () => {
            commandSuccess = await this.runPipeline(ssmRunner, input, 'analytics');
          });
          break;

        case 'status':
          await this.runPhase('setup', 'Status', 'Showing MLOps status', async () => {
            const result = await this.showStatus(ssmRunner, input);
            commandSuccess = result.success;
            output = result.output;
          });
          break;

        case 'verify':
          await this.runPhase('setup', 'Verify', 'Verifying S3 contents', async () => {
            commandSuccess = await this.verifyS3(input);
          });
          break;

        case 'metrics':
          await this.runPhase('setup', 'Metrics', 'Showing model metrics', async () => {
            const result = await this.showMetrics(input);
            commandSuccess = result.success;
            output = result.output;
          });
          break;

        case 'results':
          await this.runPhase('setup', 'Results', `Showing ${input.resultType || 'analytics'} results`, async () => {
            const result = await this.showResults(input);
            commandSuccess = result.success;
            output = result.output;
          });
          break;

        case 'clean':
          await this.runPhase('action', 'Clean', 'Deleting MLOps jobs', async () => {
            commandSuccess = await this.cleanJobs(ssmRunner, input);
          });
          break;

        case 'clean-all':
          await this.runPhase('action', 'Clean All', 'Deleting all MLOps resources', async () => {
            commandSuccess = await this.cleanAll(ssmRunner, input);
          });
          break;

        case 'info':
          await this.runPhase('setup', 'Info', 'Showing configuration', async () => {
            const result = await this.showInfo(ssmRunner, input);
            commandSuccess = result.success;
            output = result.output;
          });
          break;

        case 'smoke':
          await this.runPhase('verification', 'Smoke Test', 'Running MLOps smoke test', async () => {
            commandSuccess = await this.runSmokeTest(ssmRunner, input);
          });
          break;

        default:
          throw new Error(`Unknown command: ${input.command}`);
      }

      return this.buildResult({
        command: input.command,
        commandSuccess,
        output,
        jobStatus,
      });

    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }

  // ============================================================
  // kubectl wrapper
  // ============================================================

  private async kubectl(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput,
    args: string,
    stdin?: string
  ): Promise<{ output: string; success: boolean; error?: string }> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      stdin
        ? [`echo '${Buffer.from(stdin).toString('base64')}' | base64 -d | kubectl ${args}`]
        : [`kubectl ${args}`],
    ]);

    const result = await ssmRunner.execute(cmds, {
      timeout: 120,
      label: `kubectl ${args.split(' ')[0]}`,
    });

    return {
      output: result.output || '',
      success: result.success,
      error: result.error,
    };
  }

  // ============================================================
  // Command Implementations
  // ============================================================

  private async deployResources(ssmRunner: SSMCommandRunner, input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;

    // 1. Deploy namespace
    log.info('[1/3] Deploying namespace...');
    const namespaceFile = path.join(input.k8sDir, 'namespace-mlops.yaml');
    const namespaceYaml = fs.readFileSync(namespaceFile, 'utf-8');
    const nsResult = await this.kubectl(ssmRunner, input, 'apply -f -', namespaceYaml);
    if (!nsResult.success) {
      log.fail(`Failed to deploy namespace: ${nsResult.error}`);
      return false;
    }
    console.log(`  ${nsResult.output.trim()}`);

    // 2. Deploy configmap
    log.info('[2/3] Deploying configmap...');
    const configmapYaml = fs.readFileSync(path.join(input.k8sDir, 'configmap.yaml'), 'utf-8')
      .replace(/S3_BUCKET:.*/, `S3_BUCKET: "${input.s3Bucket}"`);
    const cmResult = await this.kubectl(ssmRunner, input, 'apply -f -', configmapYaml);
    if (!cmResult.success) {
      log.fail(`Failed to deploy configmap: ${cmResult.error}`);
      return false;
    }
    console.log(`  ${cmResult.output.trim()}`);

    // 3. Deploy serviceaccount
    log.info('[3/3] Deploying serviceaccount...');
    const saYaml = fs.readFileSync(path.join(input.k8sDir, 'serviceaccount.yaml'), 'utf-8')
      .replace(/eks\.amazonaws\.com\/role-arn:.*/, `eks.amazonaws.com/role-arn: "${input.roleArn}"`);
    const saResult = await this.kubectl(ssmRunner, input, 'apply -f -', saYaml);
    if (!saResult.success) {
      log.fail(`Failed to deploy serviceaccount: ${saResult.error}`);
      return false;
    }
    console.log(`  ${saResult.output.trim()}`);

    log.pass('MLOps resources deployed');
    return true;
  }

  private async runJob(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput
  ): Promise<{ success: boolean; jobStatus?: { name: string; completed: boolean } }> {
    const log = defaultLog;
    const jobName = input.jobName;

    if (!jobName) {
      log.fail('Job name is required');
      return { success: false };
    }

    const job = MLOPS_JOBS[jobName];
    if (!job) {
      log.fail(`Unknown job: ${jobName}`);
      log.info(`Available jobs: ${Object.keys(MLOPS_JOBS).join(', ')}`);
      return { success: false };
    }

    // Delete existing job
    log.info(`Deleting existing job ${job.k8sName}...`);
    await this.kubectl(ssmRunner, input, `delete job ${job.k8sName} -n mlops --ignore-not-found`);

    // Apply new job
    log.info(`Applying job ${job.k8sName}...`);
    const jobYaml = fs.readFileSync(path.join(input.k8sDir, job.fileName), 'utf-8')
      .replace(/PLACEHOLDER_ECR_URL/g, input.ecrUrl);

    const result = await this.kubectl(ssmRunner, input, 'apply -f -', jobYaml);
    if (!result.success) {
      log.fail(`Failed to apply job: ${result.error}`);
      return { success: false };
    }
    console.log(`  ${result.output.trim()}`);

    log.pass(`Job ${jobName} started`);
    return { success: true, jobStatus: { name: jobName, completed: false } };
  }

  private async waitJob(ssmRunner: SSMCommandRunner, input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;
    const jobName = input.jobName;

    if (!jobName) {
      log.fail('Job name is required');
      return false;
    }

    const job = MLOPS_JOBS[jobName];
    if (!job) {
      log.fail(`Unknown job: ${jobName}`);
      return false;
    }

    const timeout = input.timeout || STEP_TIMEOUTS[jobName] || 300;
    log.info(`Waiting for job ${job.k8sName} (timeout: ${timeout}s)...`);

    const result = await this.kubectl(
      ssmRunner,
      input,
      `wait --for=condition=complete job/${job.k8sName} -n mlops --timeout=${timeout}s`
    );

    if (!result.success) {
      log.fail(`Job did not complete: ${result.error || result.output}`);
      return false;
    }

    log.pass(`Job ${jobName} completed`);
    return true;
  }

  private async showLogs(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput
  ): Promise<{ success: boolean; output: string }> {
    const log = defaultLog;
    const stage = input.stage;

    if (!stage) {
      log.fail('Stage is required');
      log.info(`Available stages: ${Object.values(MLOPS_JOBS).map(j => j.stage).join(', ')}`);
      return { success: false, output: '' };
    }

    const result = await this.kubectl(ssmRunner, input, `logs -l stage=${stage} -n mlops --tail=100`);
    return { success: result.success, output: result.output };
  }

  private async runPipeline(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput,
    type: 'full' | 'analytics'
  ): Promise<boolean> {
    const log = defaultLog;

    const steps = type === 'full'
      ? [
          { phase: 1, total: 7, desc: 'Deploy resources', action: () => this.deployResources(ssmRunner, input) },
          { phase: 2, total: 7, desc: 'Generate data', job: 'generate' },
          { phase: 3, total: 7, desc: 'Preprocess data', job: 'preprocess' },
          { phase: 4, total: 7, desc: 'Train model', job: 'train' },
          { phase: 5, total: 7, desc: 'Run analytics', job: 'analytics' },
          { phase: 6, total: 7, desc: 'Generate reviews', job: 'generate-reviews' },
          { phase: 7, total: 7, desc: 'Sentiment analysis', job: 'sentiment' },
        ]
      : [
          { phase: 1, total: 4, desc: 'Deploy resources', action: () => this.deployResources(ssmRunner, input) },
          { phase: 2, total: 4, desc: 'Run analytics', job: 'analytics' },
          { phase: 3, total: 4, desc: 'Generate reviews', job: 'generate-reviews' },
          { phase: 4, total: 4, desc: 'Sentiment analysis', job: 'sentiment' },
        ];

    for (const step of steps) {
      log.phase(step.phase, `[${step.phase}/${step.total}] ${step.desc}`);

      if (step.action) {
        const result = await step.action();
        if (!result) return false;
      } else if (step.job) {
        const result = await this.runJobWithRetry(ssmRunner, input, step.job);
        if (!result) return false;
      }
      console.log('');
    }

    log.pass(`${type === 'full' ? 'Full E2E' : 'Analytics + Sentiment'} Pipeline Complete`);
    await this.verifyS3(input);
    return true;
  }

  private async runJobWithRetry(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput,
    jobName: string,
    maxRetries = 2
  ): Promise<boolean> {
    const log = defaultLog;
    const job = MLOPS_JOBS[jobName];
    if (!job) {
      log.fail(`Unknown job: ${jobName}`);
      return false;
    }

    const timeout = STEP_TIMEOUTS[jobName] || 300;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        log.warn(`Retry ${attempt}/${maxRetries} for ${jobName}...`);
        await this.kubectl(ssmRunner, input, `delete job/${job.k8sName} -n mlops --ignore-not-found`);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Run job
      const jobResult = await this.runJob(ssmRunner, { ...input, jobName });
      if (!jobResult.success) {
        log.warn(`Job ${jobName} failed to start (attempt ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) {
          await this.showLogs(ssmRunner, { ...input, stage: job.stage });
          return false;
        }
        continue;
      }

      // Wait for completion
      log.info(`Waiting for ${jobName} (timeout: ${timeout}s)...`);
      const waitResult = await this.kubectl(
        ssmRunner,
        input,
        `wait --for=condition=complete job/${job.k8sName} -n mlops --timeout=${timeout}s`
      );

      if (waitResult.success) {
        log.pass(`Job ${jobName} completed`);
        return true;
      }

      // Check if job failed
      const statusResult = await this.kubectl(
        ssmRunner,
        input,
        `get job/${job.k8sName} -n mlops -o jsonpath='{.status.failed}'`
      );
      const failedCount = parseInt(statusResult.output?.replace(/'/g, '') || '0');

      if (failedCount > 0 || attempt === maxRetries) {
        log.fail(`Job ${jobName} failed after ${attempt} attempts. Showing logs:`);
        await this.showLogs(ssmRunner, { ...input, stage: job.stage });
        return false;
      }
    }

    return false;
  }

  private async showStatus(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput
  ): Promise<{ success: boolean; output: string }> {
    const log = defaultLog;
    const outputs: string[] = [];

    // Pods
    log.section('Pods');
    const podsResult = await this.kubectl(ssmRunner, input, 'get pods -n mlops');
    console.log(podsResult.output || 'No pods found');
    outputs.push(podsResult.output);

    // Jobs
    log.section('Jobs');
    const jobsResult = await this.kubectl(ssmRunner, input, 'get jobs -n mlops');
    console.log(jobsResult.output || 'No jobs found');
    outputs.push(jobsResult.output);

    // S3 Contents
    log.section('S3 Contents');
    const s3Result = aws(`s3 ls s3://${input.s3Bucket}/ --recursive`, { ignoreError: true, region: input.region });
    if (s3Result) {
      console.log(s3Result);
      outputs.push(s3Result);
    } else {
      console.log('S3 bucket not accessible or empty');
    }

    return { success: true, output: outputs.join('\n') };
  }

  private async verifyS3(input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;
    const prefixes = ['raw', 'processed', 'models', 'analytics'];

    for (const prefix of prefixes) {
      log.section(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      const result = aws(`s3 ls s3://${input.s3Bucket}/${prefix}/`, { ignoreError: true, region: input.region });
      if (result) {
        console.log(result);
      } else {
        console.log(`No ${prefix} data`);
      }
    }

    return true;
  }

  private async showMetrics(input: ManageMLOpsInput): Promise<{ success: boolean; output: string }> {
    const log = defaultLog;
    const result = aws(`s3 cp s3://${input.s3Bucket}/models/metrics.json -`, { ignoreError: true, region: input.region });

    if (result) {
      try {
        const metrics = JSON.parse(result);
        const output = JSON.stringify(metrics, null, 2);
        console.log(output);
        return { success: true, output };
      } catch {
        console.log(result);
        return { success: true, output: result };
      }
    }

    log.warn('No metrics found');
    return { success: true, output: '' };
  }

  private async showResults(input: ManageMLOpsInput): Promise<{ success: boolean; output: string }> {
    const log = defaultLog;
    const resultType = input.resultType || 'analytics';

    const s3Path = resultType === 'sentiment'
      ? `s3://${input.s3Bucket}/analytics/sentiment_results.json`
      : `s3://${input.s3Bucket}/analytics/analytics_latest.json`;

    const result = aws(`s3 cp ${s3Path} -`, { ignoreError: true, region: input.region });

    if (result) {
      try {
        const data = JSON.parse(result);
        const output = JSON.stringify(data, null, 2);
        console.log(output);
        return { success: true, output };
      } catch {
        console.log(result);
        return { success: true, output: result };
      }
    }

    log.warn(`No ${resultType} results found`);
    return { success: true, output: '' };
  }

  private async cleanJobs(ssmRunner: SSMCommandRunner, input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;
    const jobNames = Object.values(MLOPS_JOBS).map(j => j.k8sName).join(' ');

    log.info(`Jobs to delete: ${jobNames}`);
    log.info('Note: S3 data will NOT be deleted.');

    const result = await this.kubectl(ssmRunner, input, `delete job ${jobNames} -n mlops --ignore-not-found`);
    if (result.output) {
      console.log(result.output);
    }

    log.pass('MLOps jobs cleaned (S3 data preserved)');
    return true;
  }

  private async cleanAll(ssmRunner: SSMCommandRunner, input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;

    log.warn('Deleting all MLOps K8s resources...');

    // Delete jobs
    log.info('Deleting jobs...');
    const jobNames = Object.values(MLOPS_JOBS).map(j => j.k8sName).join(' ');
    await this.kubectl(ssmRunner, input, `delete job ${jobNames} -n mlops --ignore-not-found`);

    // Delete configmap
    log.info('Deleting configmap...');
    await this.kubectl(ssmRunner, input, 'delete configmap mlops-config -n mlops --ignore-not-found');

    // Delete serviceaccount
    log.info('Deleting serviceaccount...');
    await this.kubectl(ssmRunner, input, 'delete serviceaccount mlops-sa -n mlops --ignore-not-found');

    log.pass('All MLOps resources cleaned');
    return true;
  }

  private async showInfo(
    ssmRunner: SSMCommandRunner,
    input: ManageMLOpsInput
  ): Promise<{ success: boolean; output: string }> {
    const log = defaultLog;
    const outputs: string[] = [];

    console.log(`  S3 Bucket:    ${input.s3Bucket}`);
    console.log(`  IRSA Role:    ${input.roleArn}`);
    console.log(`  ECR URL:      ${input.ecrUrl}`);
    console.log(`  Cluster:      ${input.clusterName}`);
    console.log(`  Bastion ID:   ${input.bastionId}`);
    console.log(`  Region:       ${input.region}`);

    log.section('K8s Paths');
    console.log(`  K8s Dir:      ${input.k8sDir}`);

    log.section('Available Jobs');
    for (const [name, job] of Object.entries(MLOPS_JOBS)) {
      console.log(`  ${name.padEnd(16)} -> ${job.k8sName}`);
    }

    log.section('Namespace Status');
    const result = await this.kubectl(ssmRunner, input, 'get all -n mlops');
    if (result.output) {
      console.log(result.output);
      outputs.push(result.output);
    } else {
      console.log('  Namespace mlops not found or no resources');
    }

    return { success: true, output: outputs.join('\n') };
  }

  /**
   * Run MLOps smoke test.
   *
   * Verifies:
   * - Namespace/SA/IRSA exists
   * - S3 read/write access works
   * - Image can be pulled
   * - Job completes successfully
   */
  private async runSmokeTest(ssmRunner: SSMCommandRunner, input: ManageMLOpsInput): Promise<boolean> {
    const log = defaultLog;
    const job = MLOPS_JOBS['smoke'];
    const timeout = STEP_TIMEOUTS['smoke'] || 60;

    // Step 1: Delete existing smoke job
    log.info('[1/4] Cleaning up previous smoke job...');
    await this.kubectl(ssmRunner, input, `delete job ${job.k8sName} -n mlops --ignore-not-found`);

    // Step 2: Apply smoke job
    log.info('[2/4] Applying smoke job...');
    const jobYaml = fs.readFileSync(path.join(input.k8sDir, job.fileName), 'utf-8')
      .replace(/PLACEHOLDER_ECR_URL/g, input.ecrUrl);

    const applyResult = await this.kubectl(ssmRunner, input, 'apply -f -', jobYaml);
    if (!applyResult.success) {
      log.fail(`Failed to apply smoke job: ${applyResult.error}`);
      return false;
    }
    console.log(`  ${applyResult.output.trim()}`);

    // Step 3: Wait for completion
    log.info(`[3/4] Waiting for completion (timeout: ${timeout}s)...`);
    const waitResult = await this.kubectl(
      ssmRunner,
      input,
      `wait --for=condition=complete job/${job.k8sName} -n mlops --timeout=${timeout}s`
    );

    if (!waitResult.success) {
      log.fail(`Smoke job did not complete: ${waitResult.error || waitResult.output}`);

      // Show logs for debugging
      log.info('Showing job logs:');
      const logsResult = await this.kubectl(ssmRunner, input, `logs -l stage=smoke -n mlops --tail=50`);
      if (logsResult.output) {
        console.log(logsResult.output);
      }

      return false;
    }

    // Step 4: Show logs
    log.info('[4/4] Smoke job logs:');
    const logsResult = await this.kubectl(ssmRunner, input, `logs -l stage=smoke -n mlops --tail=20`);
    if (logsResult.output) {
      console.log(logsResult.output);
    }

    log.pass('MLOps smoke test passed - IRSA and S3 access verified');
    return true;
  }
}
