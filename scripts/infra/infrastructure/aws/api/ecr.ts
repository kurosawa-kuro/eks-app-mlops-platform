/**
 * AWS ECR utilities.
 */

import { execSync } from 'child_process';
import { aws } from '../../shell/index.js';
import { log } from '../../../framework/logging/index.js';
import { validateResourceName } from '../../../framework/utils/validation.js';
import {
  safeParseJson,
  ECRCreateRepositorySchema,
  ECRImageArraySchema,
} from '../../types.js';
import type { ECRRepositoryResult, ECRImage } from '../../types.js';

export function ecrGetRegistryUrl(accountId: string, region: string): string {
  return `${accountId}.dkr.ecr.${region}.amazonaws.com`;
}

/**
 * [BOUNDARY: Shell Process + Docker]
 * Login to ECR using Docker.
 */
export function ecrDockerLogin(region: string, accountId: string): boolean {
  const registryUrl = ecrGetRegistryUrl(accountId, region);
  try {
    execSync(`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registryUrl}`, { stdio: 'pipe' });
    log.pass(`Docker logged in to ECR: ${registryUrl}`);
    return true;
  } catch (e: unknown) {
    log.fail(`ECR Docker login failed: ${(e as Error).message || String(e)}`);
    log.debug(`Registry URL: ${registryUrl}`);
    return false;
  }
}

export function ecrListRepositories(region?: string): string[][] {
  try {
    const result = aws(
      `ecr describe-repositories --query 'repositories[*].[repositoryName,repositoryUri,createdAt]' --output json`,
      { silent: true, region }
    );
    return JSON.parse(result || '[]');
  } catch (e: unknown) {
    log.debug(`ecrListRepositories failed: ${(e as Error).message || String(e)}`);
    return [];
  }
}

export function ecrRepositoryExists(repoName: string, region?: string): boolean {
  repoName = validateResourceName(repoName, 'ECR repository');
  try {
    aws(`ecr describe-repositories --repository-names ${repoName}`, { silent: true, region });
    return true;
  } catch {
    return false;
  }
}

export function ecrCreateRepository(repoName: string, region?: string): ECRRepositoryResult {
  repoName = validateResourceName(repoName, 'ECR repository');
  const result = aws(
    `ecr create-repository --repository-name ${repoName} --image-scanning-configuration scanOnPush=true --output json`,
    { silent: true, region }
  );
  const parsed = safeParseJson(result, ECRCreateRepositorySchema);
  return parsed ?? {};
}

export function ecrListImages(repoName: string, region?: string): ECRImage[] {
  repoName = validateResourceName(repoName, 'ECR repository');
  try {
    const result = aws(
      `ecr describe-images --repository-name ${repoName} --query 'imageDetails[*]' --output json`,
      { silent: true, region }
    );
    return safeParseJson(result, ECRImageArraySchema) ?? [];
  } catch (e: unknown) {
    log.debug(`ecrListImages failed for ${repoName}: ${(e as Error).message || String(e)}`);
    return [];
  }
}

export function ecrSetLifecyclePolicy(repoName: string, region?: string, maxImages = 10): boolean {
  repoName = validateResourceName(repoName, 'ECR repository');
  const policy = {
    rules: [{
      rulePriority: 1,
      description: `Keep only ${maxImages} images`,
      selection: { tagStatus: 'any', countType: 'imageCountMoreThan', countNumber: maxImages },
      action: { type: 'expire' },
    }],
  };
  try {
    aws(`ecr put-lifecycle-policy --repository-name ${repoName} --lifecycle-policy-text '${JSON.stringify(policy)}'`, { silent: true, region });
    log.pass(`Lifecycle policy set for ${repoName}`);
    return true;
  } catch (e: unknown) {
    log.fail(`Failed to set lifecycle policy for ${repoName}: ${(e as Error).message || String(e)}`);
    return false;
  }
}
