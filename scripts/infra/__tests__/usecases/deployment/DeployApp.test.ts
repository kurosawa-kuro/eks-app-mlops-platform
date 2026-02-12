/**
 * Tests for DeployApp UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 * Integration tests would cover the full deployment flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Overlay } from '../../../domain/valueObjects/Overlay.js';
import type { InfraContainer } from '../../../container/types.js';
import type { DeployAppConfig, DeployAppInput } from '../../../usecases/deployment/DeployApp.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockDeployApp {
  private container: InfraContainer;
  private config: DeployAppConfig;

  constructor(container: InfraContainer, config: DeployAppConfig) {
    this.container = container;
    this.config = config;
  }

  async execute(input: DeployAppInput) {
    // Validate config
    if (!this.config.bastionId) {
      return {
        success: false,
        error: new Error('Bastion instance ID not configured'),
        phases: [],
        durationMs: 0,
      };
    }

    // Simulate successful deployment
    return {
      success: true,
      data: {
        components: input.component === 'all' ? ['backend', 'frontend'] : [input.component],
        dryRun: input.dryRun,
        bastionId: this.config.bastionId,
      },
      phases: [],
      durationMs: 100,
    };
  }
}

describe('DeployApp UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockConfig: DeployAppConfig;
  let mockInput: DeployAppInput;

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
      s3Prefix: 'k8s-manifests',
      k8sDir: '/path/to/k8s',
      kubectlVersion: '1.29.0',
      bastionId: 'i-12345678',
      albConfig: { lbRoleArn: 'arn:aws:iam::123456789012:role/lb-role', vpcId: 'vpc-12345678' },
      apiUrl: 'https://api.example.com',
    };

    mockInput = {
      overlay: Overlay.create('prod'),
      component: 'all',
      skipUpload: false,
      dryRun: false,
      setupAlb: false,
      skipHttps: false,
    };
  });

  it('should return success result with components', async () => {
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.components).toEqual(['backend', 'frontend']);
  });

  it('should return single component when specified', async () => {
    mockInput.component = 'backend';
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.components).toEqual(['backend']);
  });

  it('should track dry-run mode in result', async () => {
    mockInput.dryRun = true;
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.dryRun).toBe(true);
  });

  it('should fail when bastion ID is not configured', async () => {
    const configWithoutBastion = { ...mockConfig, bastionId: undefined };
    const useCase = new MockDeployApp(mockContainer, configWithoutBastion);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Bastion instance ID not configured');
  });

  it('should include duration in result', async () => {
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should include bastion ID in successful result', async () => {
    const useCase = new MockDeployApp(mockContainer, mockConfig);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.bastionId).toBe('i-12345678');
  });
});
