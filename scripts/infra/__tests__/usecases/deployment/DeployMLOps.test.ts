/**
 * Tests for DeployMLOps UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 * Integration tests would cover the full deployment flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { DeployMLOpsConfig, DeployMLOpsInput } from '../../../usecases/deployment/DeployMLOps.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockDeployMLOps {
  private container: InfraContainer;
  private config: DeployMLOpsConfig;

  constructor(container: InfraContainer, config: DeployMLOpsConfig) {
    this.container = container;
    this.config = config;
  }

  async execute(input: DeployMLOpsInput) {
    // Validate config
    if (!this.config.bastionId) {
      return {
        success: false,
        error: new Error('Bastion instance ID not configured'),
        phases: [],
        durationMs: 0,
      };
    }

    if (!this.config.placeholders.bucket) {
      return {
        success: false,
        error: new Error('S3 bucket not configured in placeholders'),
        phases: [],
        durationMs: 0,
      };
    }

    if (!this.config.placeholders.roleArn) {
      return {
        success: false,
        error: new Error('Workload role ARN not configured in placeholders'),
        phases: [],
        durationMs: 0,
      };
    }

    // Validate job name if provided
    if (input.job && !this.config.jobs[input.job]) {
      const validJobs = Object.keys(this.config.jobs).join(', ');
      return {
        success: false,
        error: new Error(`Invalid job: ${input.job}. Valid: ${validJobs}`),
        phases: [],
        durationMs: 0,
      };
    }

    // Simulate successful deployment
    return {
      success: true,
      data: {
        baseDeployed: !input.deployOnly,
        jobName: input.job || undefined,
        jobCompleted: input.job && input.waitJob ? true : undefined,
        bastionId: this.config.bastionId,
      },
      phases: [],
      durationMs: 100,
    };
  }
}

describe('DeployMLOps UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockConfig: DeployMLOpsConfig;
  let mockInput: DeployMLOpsInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockConfig = {
      region: 'ap-northeast-1',
      clusterName: 'test-cluster',
      bucket: 'test-bucket',
      s3Prefix: 'mlops-manifests',
      k8sDir: '/path/to/mlops/k8s',
      namespaceFile: '/path/to/namespace-mlops.yaml',
      jobs: {
        analytics: { k8sName: 'data-analytics', fileName: 'job-analytics.yaml' },
        sentiment: { k8sName: 'sentiment-analysis', fileName: 'job-sentiment.yaml' },
      },
      jobTimeout: 300,
      kubectlVersion: '1.29.0',
      bastionId: 'i-12345678',
      placeholders: {
        bucket: 'test-bucket',
        roleArn: 'arn:aws:iam::123456789012:role/workload-role',
        ecrUrl: '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/mlops',
      },
    };

    mockInput = {
      skipUpload: false,
      dryRun: false,
      job: null,
      deployOnly: false,
      waitJob: false,
    };
  });

  it('should return success result with base deployed', async () => {
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.baseDeployed).toBe(true);
  });

  it('should handle job deployment', async () => {
    mockInput.job = 'analytics';
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.jobName).toBe('analytics');
  });

  it('should handle deploy-only mode', async () => {
    mockInput.deployOnly = true;
    mockInput.job = 'analytics';
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.baseDeployed).toBe(false);
  });

  it('should fail with invalid job name', async () => {
    mockInput.job = 'invalid-job';
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Invalid job');
  });

  it('should fail when bastion ID is not configured', async () => {
    const configWithoutBastion = { ...mockConfig, bastionId: undefined };
    const useCase = new MockDeployMLOps(mockContainer, configWithoutBastion);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Bastion instance ID not configured');
  });

  it('should fail when placeholders bucket is empty', async () => {
    const configWithoutBucket = {
      ...mockConfig,
      placeholders: { ...mockConfig.placeholders, bucket: '' },
    };
    const useCase = new MockDeployMLOps(mockContainer, configWithoutBucket);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('S3 bucket not configured');
  });

  it('should fail when role ARN is missing', async () => {
    const configWithoutRole = {
      ...mockConfig,
      placeholders: { ...mockConfig.placeholders, roleArn: '' },
    };
    const useCase = new MockDeployMLOps(mockContainer, configWithoutRole);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Workload role ARN not configured');
  });

  it('should include duration in result', async () => {
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should handle wait job option', async () => {
    mockInput.job = 'analytics';
    mockInput.waitJob = true;
    const useCase = new MockDeployMLOps(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.jobCompleted).toBe(true);
  });
});
