#!/usr/bin/env npx tsx
/**
 * ECR Management Script
 * Manage Amazon ECR repositories: login, list, create, show images, build, push
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type { ECRImage } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

// ============================================================
// Build Target Configurations
// ============================================================

interface BuildTarget {
  name: string;
  description: string;
  dockerfile: string;
  context: string;
  privateRepo: string;
  publicRepo: string;
}

const BUILD_TARGETS: Record<string, BuildTarget> = {
  frontend: {
    name: 'frontend',
    description: 'Next.js Frontend Application',
    dockerfile: 'apps/app-frontend/Dockerfile',
    context: 'apps/app-frontend',
    privateRepo: 'app-frontend',
    publicRepo: 'public.ecr.aws/s0n1j8n3/app-frontend',
  },
  backend: {
    name: 'backend',
    description: 'Hono Backend API',
    dockerfile: 'apps/app-backend/Dockerfile',
    context: 'apps/app-backend',
    privateRepo: 'app-backend',
    publicRepo: 'public.ecr.aws/s0n1j8n3/app-backend',
  },
  // MLOps
  mlops: {
    name: 'mlops',
    description: 'MLOps Pipeline',
    dockerfile: 'mlops/docker/Dockerfile',
    context: 'mlops',
    privateRepo: 'mlops-pipeline',
    publicRepo: 'public.ecr.aws/s0n1j8n3/mlops-pipeline',
  },
};

class EcrManage extends AwsCommand {
  static override name = 'ecr-manage';
  static service = 'ecr';
  static override description = 'ECR Management Script';

  static override commands: Record<string, CommandDefinition> = {
    // Build & Push
    build: { desc: 'Build Docker image', args: '<target>', aliases: ['b'], requireDocker: true },
    push: { desc: 'Build and push to ECR', args: '<target>', aliases: ['p'], requireAws: true, requireDocker: true },
    'push-public': { desc: 'Push to ECR Public', args: '<target>', aliases: ['pp'], requireAws: true, requireDocker: true },
    targets: { desc: 'List available build targets', aliases: ['t'] },

    // ECR Management
    login: { desc: 'Docker login to ECR registry', requireAws: true, requireDocker: true },
    'login-public': { desc: 'Docker login to ECR Public', requireAws: true, requireDocker: true },
    list: { desc: 'List all ECR repositories', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show repository details and recent images', args: '<repo-name>', aliases: ['info'], requireAws: true },
    create: { desc: 'Create a new ECR repository', args: '<repo-name>', aliases: ['new'], requireAws: true },
    delete: { desc: 'Delete an ECR repository', args: '<repo-name>', aliases: ['rm'], requireAws: true },
    images: { desc: 'List all images in a repository', args: '<repo-name>', aliases: ['img'], requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--max-images': { name: 'maxImages', type: 'string', desc: 'Set lifecycle policy to keep n images (default: 10)' },
    '--force': { name: 'force', type: 'boolean', desc: 'Force delete (skip confirmation, delete images)' },
    '--no-cache': { name: 'noCache', type: 'boolean', desc: 'Build without Docker cache' },
    '--tag': { name: 'tag', type: 'string', desc: 'Image tag (default: latest)' },
  };

  // ============================================================
  // Build & Push Commands
  // ============================================================

  private getTarget(targetName?: string): BuildTarget | null {
    const name = targetName || this.args[0];
    if (!name) {
      lib.log.fail('Target name is required');
      lib.log.info(`Available targets: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      return null;
    }

    const target = BUILD_TARGETS[name];
    if (!target) {
      lib.log.fail(`Unknown target: ${name}`);
      lib.log.info(`Available targets: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      return null;
    }

    return target;
  }

  async cmdTargets(): Promise<number> {
    lib.log.header('Available Build Targets');

    console.log('');
    for (const [key, target] of Object.entries(BUILD_TARGETS)) {
      console.log(`  ${lib.c.cyan(key.padEnd(10))} ${target.description}`);
      console.log(`             Dockerfile: ${target.dockerfile}`);
      console.log(`             Context:    ${target.context}`);
      console.log(`             Private:    ${target.privateRepo}`);
      console.log(`             Public:     ${target.publicRepo}`);
      console.log('');
    }

    lib.log.info('Usage:');
    console.log('  npx tsx ecr-manage.ts build app');
    console.log('  npx tsx ecr-manage.ts push mlops');
    console.log('  npx tsx ecr-manage.ts push-public app');

    return 0;
  }

  async cmdBuild(targetName?: string): Promise<number> {
    const target = this.getTarget(targetName);
    if (!target) return 1;

    const tag = (this.options.tag as string) || 'latest';
    const noCache = this.options.noCache as boolean;

    lib.log.header(`Build: ${target.name}`);

    const dockerfile = path.join(PROJECT_ROOT, target.dockerfile);
    const context = path.join(PROJECT_ROOT, target.context);
    const imageName = `${target.privateRepo}:${tag}`;

    lib.log.info(`Target:     ${target.description}`);
    lib.log.info(`Dockerfile: ${dockerfile}`);
    lib.log.info(`Context:    ${context}`);
    lib.log.info(`Image:      ${imageName}`);
    if (noCache) lib.log.info('Cache:      disabled');
    console.log('');

    const args = ['build', '-t', imageName, '-f', dockerfile];
    if (noCache) args.push('--no-cache');
    args.push(context);

    lib.log.info('Building...');
    const result = spawnSync('docker', args, { stdio: 'inherit', cwd: PROJECT_ROOT });

    if (result.status !== 0) {
      lib.log.fail('Build failed');
      return 1;
    }

    lib.log.pass(`Built ${imageName}`);
    return 0;
  }

  async cmdPush(targetName?: string): Promise<number> {
    const target = this.getTarget(targetName);
    if (!target) return 1;

    const tag = (this.options.tag as string) || 'latest';

    // Build first
    const buildResult = await this.cmdBuild(target.name);
    if (buildResult !== 0) return buildResult;

    lib.log.header(`Push to Private ECR: ${target.name}`);

    // Login to ECR
    const loginResult = await this.cmdLogin();
    if (loginResult !== 0) return loginResult;

    // Get registry URL
    const accountId = lib.awsGetAccountId();
    if (!accountId) {
      lib.log.fail('Failed to get AWS account ID');
      return 1;
    }
    const registryUrl = lib.ecrGetRegistryUrl(accountId, this.region);
    const localImage = `${target.privateRepo}:${tag}`;
    const remoteImage = `${registryUrl}/${target.privateRepo}:${tag}`;

    // Delete existing tag if exists (for idempotency)
    lib.log.info(`Checking existing tag ${tag}...`);
    const deleteResult = spawnSync('aws', [
      'ecr', 'batch-delete-image',
      '--repository-name', target.privateRepo,
      '--image-ids', `imageTag=${tag}`,
      '--region', this.region,
    ], { stdio: 'pipe' });
    if (deleteResult.status === 0) {
      lib.log.info(`Deleted existing tag ${tag}`);
    }

    // Tag
    lib.log.info(`Tagging ${localImage} -> ${remoteImage}`);
    const tagResult = spawnSync('docker', ['tag', localImage, remoteImage], { stdio: 'inherit' });
    if (tagResult.status !== 0) {
      lib.log.fail('Tag failed');
      return 1;
    }

    // Push
    lib.log.info(`Pushing ${remoteImage}...`);
    const pushResult = spawnSync('docker', ['push', remoteImage], { stdio: 'inherit' });
    if (pushResult.status !== 0) {
      lib.log.fail('Push failed');
      return 1;
    }

    lib.log.pass(`Pushed ${remoteImage}`);
    return 0;
  }

  async cmdPushPublic(targetName?: string): Promise<number> {
    const target = this.getTarget(targetName);
    if (!target) return 1;

    const tag = (this.options.tag as string) || 'latest';

    // Build first
    const buildResult = await this.cmdBuild(target.name);
    if (buildResult !== 0) return buildResult;

    lib.log.header(`Push to ECR Public: ${target.name}`);

    // Login to ECR Public
    const loginResult = await this.cmdLoginPublic();
    if (loginResult !== 0) return loginResult;

    const localImage = `${target.privateRepo}:${tag}`;
    const remoteImage = `${target.publicRepo}:${tag}`;

    // Tag
    lib.log.info(`Tagging ${localImage} -> ${remoteImage}`);
    const tagResult = spawnSync('docker', ['tag', localImage, remoteImage], { stdio: 'inherit' });
    if (tagResult.status !== 0) {
      lib.log.fail('Tag failed');
      return 1;
    }

    // Push
    lib.log.info(`Pushing ${remoteImage}...`);
    const pushResult = spawnSync('docker', ['push', remoteImage], { stdio: 'inherit' });
    if (pushResult.status !== 0) {
      lib.log.fail('Push failed');
      return 1;
    }

    lib.log.pass(`Pushed ${remoteImage}`);
    return 0;
  }

  async cmdLoginPublic(): Promise<number> {
    lib.log.header('Docker Login to ECR Public');

    lib.log.info('Region: us-east-1 (ECR Public)');
    lib.log.info('Registry: public.ecr.aws');
    console.log('');

    lib.log.info('Logging in to ECR Public...');

    // Get login password
    const password = lib.run('aws ecr-public get-login-password --region us-east-1', { silent: true });
    if (!password) {
      lib.log.fail('Failed to get ECR Public login password');
      return 1;
    }

    // Docker login
    const result = spawnSync('docker', ['login', '--username', 'AWS', '--password-stdin', 'public.ecr.aws'], {
      input: password,
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    if (result.status !== 0) {
      lib.log.fail('Login failed');
      return 1;
    }

    lib.log.pass('Login successful (ECR Public)');
    return 0;
  }

  // ============================================================
  // ECR Management Commands
  // ============================================================

  async cmdLogin(): Promise<number> {
    lib.log.header('Docker Login to ECR');

    const accountId = lib.awsGetAccountId();
    if (!accountId) {
      lib.log.fail('Failed to get AWS account ID');
      return 1;
    }

    const registryUrl = lib.ecrGetRegistryUrl(accountId, this.region);

    lib.log.info(`Account ID: ${accountId}`);
    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Registry: ${registryUrl}`);
    console.log('');

    lib.log.info('Logging in to ECR...');

    if (lib.ecrDockerLogin(this.region, accountId)) {
      lib.log.pass('Login successful!');
      console.log('');
      lib.log.info('Token is valid for 12 hours');
      lib.log.info(`Registry: ${registryUrl}`);
      console.log('');
      lib.log.info('Example push:');
      lib.log.info(`  docker tag my-image:latest ${registryUrl}/my-repo:latest`);
      lib.log.info(`  docker push ${registryUrl}/my-repo:latest`);
      return 0;
    } else {
      lib.log.fail('Login failed!');
      console.log('');
      lib.log.info('Troubleshooting:');
      console.log('  1. Verify AWS credentials are configured');
      console.log('  2. Check IAM permissions for ecr:GetAuthorizationToken');
      console.log('  3. Ensure Docker daemon is running');
      return 1;
    }
  }

  async cmdList(): Promise<number> {
    lib.log.header('ECR Repositories');

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const repos = lib.ecrListRepositories(this.region);

    if (repos.length === 0) {
      lib.log.info('No repositories found');
      return 0;
    }

    lib.log.pass(`Found ${repos.length} repository(ies)`);
    console.log('');

    const rows = repos.map(([name, uri, created]) => [
      name || '',
      uri || '',
      lib.formatDate(created),
    ]);
    this.formatTable(['NAME', 'URI', 'CREATED'], rows, [30, 70, 20]);

    return 0;
  }

  async cmdShow(repoName?: string): Promise<number> {
    if (!repoName) {
      lib.log.fail('Repository name is required');
      console.log('');
      console.log('Usage: node ecr-manage.js show <repo-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(repoName, 'repository'))) {
      return 1;
    }

    lib.log.header(`ECR Repository: ${repoName}`);

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    if (!lib.ecrRepositoryExists(repoName, this.region)) {
      lib.log.fail(`Repository '${repoName}' not found`);
      return 1;
    }

    const accountId = lib.awsGetAccountId();
    const registryUrl = lib.ecrGetRegistryUrl(accountId || '', this.region);

    lib.log.section('Repository Information');
    console.log(`  Name:     ${repoName}`);
    console.log(`  URI:      ${registryUrl}/${repoName}`);
    console.log(`  Region:   ${this.region}`);

    // List images
    lib.log.section('Images');
    const images = lib.ecrListImages(repoName, this.region);

    if (images.length === 0) {
      lib.log.info('No images found');
    } else {
      images.sort((a: ECRImage, b: ECRImage) =>
        new Date(b.imagePushedAt || 0).getTime() - new Date(a.imagePushedAt || 0).getTime()
      );

      lib.log.pass(`Found ${images.length} image(s)`);
      console.log('');
      console.log('  ' + 'TAG'.padEnd(25) + 'SIZE'.padEnd(15) + 'PUSHED');
      console.log('  ' + '---'.padEnd(25) + '----'.padEnd(15) + '------');

      const recentImages = images.slice(0, 10);
      for (const img of recentImages) {
        const tags = img.imageTags?.join(', ') || '<untagged>';
        const size = lib.formatBytes(img.imageSizeInBytes || 0);
        const pushed = lib.formatDate(img.imagePushedAt);
        console.log('  ' + tags.substring(0, 24).padEnd(25) + size.padEnd(15) + pushed);
      }

      if (images.length > 10) {
        console.log(`  ... and ${images.length - 10} more`);
      }
    }

    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Pull:   docker pull ${registryUrl}/${repoName}:latest`);
    lib.log.info(`  Push:   docker push ${registryUrl}/${repoName}:latest`);

    return 0;
  }

  async cmdCreate(repoName?: string): Promise<number> {
    const maxImages = parseInt(this.options.maxImages as string, 10) || 10;

    if (!repoName) {
      lib.log.fail('Repository name is required');
      console.log('');
      console.log('Usage: node ecr-manage.js create <repo-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(repoName, 'repository'))) {
      return 1;
    }

    lib.log.header(`Create ECR Repository: ${repoName}`);

    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Repository Name: ${repoName}`);
    console.log('');

    // Check if already exists
    if (lib.ecrRepositoryExists(repoName, this.region)) {
      lib.log.warn(`Repository '${repoName}' already exists`);

      const accountId = lib.awsGetAccountId();
      const registryUrl = lib.ecrGetRegistryUrl(accountId || '', this.region);
      lib.log.info(`URI: ${registryUrl}/${repoName}`);
      return 0;
    }

    // Create repository
    lib.log.section('Creating Repository');

    try {
      const result = lib.ecrCreateRepository(repoName, this.region);
      lib.log.pass('Repository created');

      const uri = result.repository?.repositoryUri;
      if (uri) {
        lib.log.info(`URI: ${uri}`);
      }
    } catch (error: unknown) {
      lib.log.fail(`Failed to create repository: ${toError(error).message}`);
      return 1;
    }

    // Set lifecycle policy
    lib.log.section('Setting Lifecycle Policy');
    lib.log.info(`Keeping last ${maxImages} images`);

    if (lib.ecrSetLifecyclePolicy(repoName, this.region, maxImages)) {
      lib.log.pass('Lifecycle policy set');
    } else {
      lib.log.warn('Failed to set lifecycle policy');
    }

    // Summary
    console.log('');
    lib.log.pass('Repository creation completed!');
    console.log('');

    const accountId = lib.awsGetAccountId();
    const registryUrl = lib.ecrGetRegistryUrl(accountId || '', this.region);

    lib.log.info('Next steps:');
    console.log(`  1. Login:  node ecr-manage.js login`);
    console.log(`  2. Tag:    docker tag my-image:latest ${registryUrl}/${repoName}:latest`);
    console.log(`  3. Push:   docker push ${registryUrl}/${repoName}:latest`);

    return 0;
  }

  async cmdDelete(repoName?: string): Promise<number> {
    if (!repoName) {
      lib.log.fail('Repository name is required');
      console.log('');
      console.log('Usage: node ecr-manage.js delete <repo-name>');
      console.log('');
      console.log('Options:');
      console.log('  --force    Force delete (skip confirmation, delete all images)');
      return 1;
    }

    if (!this.validate(() => this.validateName(repoName, 'repository'))) {
      return 1;
    }

    lib.log.header(`Delete ECR Repository: ${repoName}`);

    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Repository Name: ${repoName}`);
    console.log('');

    // Check if repository exists
    if (!lib.ecrRepositoryExists(repoName, this.region)) {
      lib.log.fail(`Repository '${repoName}' not found`);
      return 1;
    }

    // Get image count
    const images = lib.ecrListImages(repoName, this.region);
    lib.log.info(`Images in repository: ${images.length}`);

    if (images.length > 0 && !this.options.force) {
      lib.log.warn('Repository contains images. Use --force to delete with images.');
      return 1;
    }

    // Confirm deletion
    if (!this.options.force) {
      lib.log.warn('This will permanently delete the repository!');
      if (!await lib.confirm('Are you sure you want to delete this repository?')) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // Delete repository
    lib.log.section('Deleting Repository');

    try {
      const forceFlag = this.options.force ? '--force' : '';
      lib.run(
        `aws ecr delete-repository --repository-name ${repoName} ${forceFlag} --region ${this.region}`,
        { ignoreError: false }
      );
      lib.log.pass(`Repository '${repoName}' deleted successfully`);
      return 0;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('RepositoryNotEmptyException')) {
        lib.log.fail('Repository is not empty. Use --force to delete with images.');
      } else {
        lib.log.fail(`Failed to delete repository: ${err.message}`);
      }
      return 1;
    }
  }

  async cmdImages(repoName?: string): Promise<number> {
    if (!repoName) {
      lib.log.fail('Repository name is required');
      console.log('');
      console.log('Usage: node ecr-manage.js images <repo-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(repoName, 'repository'))) {
      return 1;
    }

    lib.log.header(`ECR Images: ${repoName}`);

    if (!lib.ecrRepositoryExists(repoName, this.region)) {
      lib.log.fail(`Repository '${repoName}' not found`);
      return 1;
    }

    const images = lib.ecrListImages(repoName, this.region);

    if (images.length === 0) {
      lib.log.info('No images found');
      return 0;
    }

    images.sort((a: ECRImage, b: ECRImage) =>
      new Date(b.imagePushedAt || 0).getTime() - new Date(a.imagePushedAt || 0).getTime()
    );

    lib.log.pass(`Found ${images.length} image(s)`);
    console.log('');

    console.log('  ' + 'TAG'.padEnd(30) + 'DIGEST'.padEnd(25) + 'SIZE'.padEnd(12) + 'PUSHED');
    console.log('  ' + '---'.padEnd(30) + '------'.padEnd(25) + '----'.padEnd(12) + '------');

    for (const img of images) {
      const tags = img.imageTags?.join(', ') || '<untagged>';
      const digest = (img.imageDigest || '').substring(7, 19);
      const size = lib.formatBytes(img.imageSizeInBytes || 0);
      const pushed = lib.formatDate(img.imagePushedAt);
      console.log('  ' + tags.substring(0, 29).padEnd(30) + digest.padEnd(25) + size.padEnd(12) + pushed);
    }

    return 0;
  }
}

EcrManage.main();
