#!/usr/bin/env npx tsx
/**
 * Kubernetes Deploy CLI
 *
 * Thin CLI wrapper that orchestrates K8s deployments using UseCases.
 * Supports app, mlops, gpu, and status commands.
 *
 * Usage:
 *   npx tsx deploy.ts app [options]      # Deploy Hono app
 *   npx tsx deploy.ts mlops [options]    # Deploy MLOps resources
 *   npx tsx deploy.ts gpu [step]         # Deploy GPU/LLM infrastructure
 *   npx tsx deploy.ts status             # Show overall status
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { DeployApp, type DeployAppConfig } from '../../usecases/deployment/DeployApp.js';
import { DeployMLOps, type DeployMLOpsConfig } from '../../usecases/deployment/DeployMLOps.js';
import { DeployGPU, type DeployGPUConfig } from '../../usecases/deployment/DeployGPU.js';
import type { GPUStep } from '../../usecases/deployment/phases/types.js';
import { Overlay } from '../../domain/valueObjects/Overlay.js';
import { createConfig, VERSIONS, MODELS, DEPLOYMENT } from '../../config/index.js';
import type { OptionDefinition } from '../../framework/types.js';
import type { DeployComponent } from '../../infrastructure/kubernetes/deploy/AppManifestDeployer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, showContext, showSimpleOutcome, c } = lib;

// Configuration
const sharedConfig = createConfig();

const CONFIG = {
  region: sharedConfig.region,
  clusterName: sharedConfig.clusterName || '',
  tfDir: sharedConfig.tfDir,
  kubectlVersion: VERSIONS.kubectl,
  app: {
    s3Prefix: 'k8s-manifests',
    k8sDir: path.resolve(__dirname, '../../../../infra/k8s/apps'),
  },
  mlops: {
    s3Prefix: 'mlops-manifests',
    k8sDir: path.resolve(__dirname, '../../../../mlops/k8s'),
    namespaceFile: path.resolve(__dirname, '../../../../mlops/k8s/namespace-mlops.yaml'),
    jobs: {
      preprocess: { k8sName: 'data-preprocess', fileName: 'job-preprocess.yaml' },
      train: { k8sName: 'model-train', fileName: 'job-train.yaml' },
      analytics: { k8sName: 'data-analytics', fileName: 'job-analytics.yaml' },
      sentiment: { k8sName: 'sentiment-analysis', fileName: 'job-sentiment.yaml' },
      generate: { k8sName: 'data-generate', fileName: 'job-generate.yaml' },
      'generate-reviews': { k8sName: 'generate-reviews', fileName: 'job-generate-reviews.yaml' },
    } as const,
    jobTimeout: 300,
  },
  gpu: {
    karpenterVersion: VERSIONS.karpenter,
    vllmImage: VERSIONS.vllmImage,
    llmModel: MODELS.llm,
  },
};

/**
 * Kubernetes Deploy Command
 */
class KubernetesDeploy extends InfraCommand {
  static name = 'deploy';
  static description = 'Deploy applications to EKS cluster';
  static commands = {
    app: { desc: 'Deploy Hono backend and frontend', requireAws: true },
    mlops: { desc: 'Deploy MLOps resources and jobs', requireAws: true },
    gpu: { desc: 'Deploy GPU/LLM infrastructure', requireAws: true },
    status: { desc: 'Show overall deployment status', requireAws: true },
    help: { desc: 'Show help' },
  };
  static options: Record<string, OptionDefinition> = {
    '--skip-upload': { name: 'skipUpload', type: 'boolean' as const, desc: 'Skip S3 manifest upload' },
    '--dry-run': { name: 'dryRun', type: 'boolean' as const, desc: 'Run kubectl with --dry-run=client' },
    '--overlay': { name: 'overlay', type: 'string' as const, desc: 'Kustomize overlay' },
    '--setup-alb': { name: 'setupAlb', type: 'boolean' as const, desc: 'Install ALB Controller' },
    '--backend-only': { name: 'backendOnly', type: 'boolean' as const, desc: 'Deploy only backend' },
    '--frontend-only': { name: 'frontendOnly', type: 'boolean' as const, desc: 'Deploy only frontend' },
    '--component': { name: 'component', type: 'string' as const, desc: 'Deploy specific component' },
    '--job': { name: 'job', type: 'string' as const, desc: 'Run MLOps job' },
    '--deploy-only': { name: 'deployOnly', type: 'boolean' as const, desc: 'Skip base resources' },
    '--wait': { name: 'waitJob', type: 'boolean' as const, desc: 'Wait for job completion' },
    '--skip-https': { name: 'skipHttps', type: 'boolean' as const, desc: 'Skip HTTPS verification' },
  };

  async cmdApp(): Promise<number> {
    const overlay = Overlay.create(String(this.options.overlay || DEPLOYMENT.defaultOverlay));
    const component = this.getComponent();

    showContext('k8s-deploy', {
      clusterName: CONFIG.clusterName,
      overlay: overlay.name,
      component,
    });

    const container = createInfraContainer(CONFIG.tfDir);
    const config: DeployAppConfig = {
      region: this.region,
      clusterName: CONFIG.clusterName,
      bucket: sharedConfig.s3Bucket || '',
      s3Prefix: CONFIG.app.s3Prefix,
      k8sDir: CONFIG.app.k8sDir,
      kubectlVersion: CONFIG.kubectlVersion,
      bastionId: sharedConfig.bastionInstanceId || undefined,
      albConfig: sharedConfig.lbControllerRoleArn && sharedConfig.vpcId
        ? { lbRoleArn: sharedConfig.lbControllerRoleArn, vpcId: sharedConfig.vpcId }
        : undefined,
      apiUrl: sharedConfig.apiUrl || undefined,
    };

    const useCase = new DeployApp(container, config);
    const result = await useCase.execute({
      overlay,
      component,
      skipUpload: this.options.skipUpload === true,
      dryRun: this.options.dryRun === true,
      setupAlb: this.options.setupAlb === true,
      skipHttps: this.options.skipHttps === true,
    });

    if (result.success) {
      showSimpleOutcome(true, 'App deployment successful', 'k8s-deploy');
      return 0;
    }
    log.fail(result.error?.message || 'Deployment failed');
    return 1;
  }

  async cmdMlops(): Promise<number> {
    const job = this.options.job as string | undefined;

    showContext('k8s-deploy-mlops', { clusterName: CONFIG.clusterName });
    if (job) console.log(`  ${c.dim('Job:')} ${c.yellow(job)}`);

    const container = createInfraContainer(CONFIG.tfDir);
    const config: DeployMLOpsConfig = {
      region: this.region,
      clusterName: CONFIG.clusterName,
      bucket: sharedConfig.s3Bucket || '',
      s3Prefix: CONFIG.mlops.s3Prefix,
      k8sDir: CONFIG.mlops.k8sDir,
      namespaceFile: CONFIG.mlops.namespaceFile,
      jobs: CONFIG.mlops.jobs,
      jobTimeout: CONFIG.mlops.jobTimeout,
      kubectlVersion: CONFIG.kubectlVersion,
      bastionId: sharedConfig.bastionInstanceId || undefined,
      placeholders: {
        bucket: sharedConfig.s3Bucket || '',
        roleArn: sharedConfig.workloadRoleArn || '',
        ecrUrl: sharedConfig.ecrMlopsUrl ?? null,
      },
    };

    const useCase = new DeployMLOps(container, config);
    const result = await useCase.execute({
      skipUpload: this.options.skipUpload === true,
      dryRun: this.options.dryRun === true,
      job: job || null,
      deployOnly: this.options.deployOnly === true,
      waitJob: this.options.waitJob === true,
    });

    if (result.success) {
      showSimpleOutcome(true, 'MLOps deployment successful');
      this.showMlopsConnectInfo(result.data?.bastionId, job);
      return 0;
    }
    log.fail(result.error?.message || 'MLOps deployment failed');
    return 1;
  }

  async cmdGpu(): Promise<number> {
    const stepArg = this.args[0] || 'status';

    if (stepArg === 'help') {
      this.showGpuHelp();
      return 0;
    }

    const step = stepArg as GPUStep;

    console.log(c.bold(c.cyan('\n GPU/LLM Deployment\n')));

    const container = createInfraContainer(CONFIG.tfDir);
    const config: DeployGPUConfig = {
      region: this.region,
      clusterName: CONFIG.clusterName,
      clusterEndpoint: sharedConfig.clusterEndpoint || '',
      karpenterRoleArn: sharedConfig.karpenterRoleArn || '',
      karpenterQueueName: sharedConfig.karpenterQueueName || '',
      karpenterVersion: CONFIG.gpu.karpenterVersion,
      vllmImage: CONFIG.gpu.vllmImage,
      llmModel: CONFIG.gpu.llmModel,
      kubectlVersion: CONFIG.kubectlVersion,
      bastionId: sharedConfig.bastionInstanceId || undefined,
    };

    const useCase = new DeployGPU(container, config);
    const result = await useCase.execute({ step });

    if (result.success) {
      console.log(c.bold(c.green('\nGPU deployment completed!')));
      return 0;
    }
    log.fail(result.error?.message || 'GPU deployment failed');
    return 1;
  }

  async cmdStatus(): Promise<number> {
    console.log(c.cyan('=== EKS Overall Status ===\n'));
    // Status is handled by GPU UseCase with 'status' step
    return this.cmdGpu();
  }

  // Helper methods
  private getComponent(): DeployComponent {
    if (this.options.backendOnly) return 'backend';
    if (this.options.frontendOnly) return 'frontend';
    const comp = this.options.component as string | undefined;
    if (comp === 'backend' || comp === 'frontend') return comp;
    return 'all';
  }

  private showMlopsConnectInfo(bastionId?: string, job?: string | null): void {
    if (bastionId) {
      console.log(`\nConnect: ${c.cyan(`aws ssm start-session --target ${bastionId} --region ${this.region}`)}`);
      console.log(`Status:  ${c.cyan('kubectl get all -n mlops')}`);
      if (job) console.log(`Logs:    ${c.cyan(`kubectl logs -l stage=${job} -n mlops --tail=100`)}`);
    }
  }

  private showGpuHelp(): void {
    console.log(`
GPU Steps:
  1        Install Karpenter
  2        Deploy NVIDIA Device Plugin
  3        Deploy GPU NodePool + EC2NodeClass
  4        Deploy LLM Stack (vLLM)
  5        Redeploy Hono with LLM config
  all      Run all steps
  status   Show status

Example: npx tsx deploy.ts gpu all
`);
  }
}

KubernetesDeploy.main();
