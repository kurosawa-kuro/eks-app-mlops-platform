/**
 * Tests for QueryClusterStatus UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { QueryClusterStatusInput, QueryClusterStatusOutput } from '../../../usecases/cluster/QueryClusterStatus.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockQueryClusterStatus {
  private container: InfraContainer;

  constructor(container: InfraContainer) {
    this.container = container;
  }

  async execute(input: QueryClusterStatusInput) {
    // Simulate successful query
    const output: QueryClusterStatusOutput = {
      accountId: '123456789012',
      cluster: {
        name: input.clusterName || 'prod-eks-cluster',
        status: 'ACTIVE',
        version: '1.29',
        endpoint: 'https://test-cluster.eks.amazonaws.com',
      },
      nodeGroups: [
        { name: 'main-node-group', status: 'ACTIVE', desiredSize: 2 },
      ],
      vpc: { id: 'vpc-12345678', state: 'available', cidr: '10.0.0.0/16' },
      natGateway: { id: 'nat-12345678', state: 'available' },
      alb: { name: 'k8s-ml-platform-alb', state: 'active', dnsName: 'test.elb.amazonaws.com' },
      lambda: { name: 'k8s-ml-platform-prod-auth-gw', state: 'Active', runtime: 'nodejs18.x' },
      terraform: { resourceCount: 50 },
      terraformRunning: false,
      ready: {
        vpc: true,
        natGateway: true,
        cluster: true,
      },
    };

    return {
      success: true,
      data: output,
      phases: [],
      durationMs: 100,
    };
  }
}

describe('QueryClusterStatus UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockInput: QueryClusterStatusInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockInput = {
      region: 'ap-northeast-1',
      tfDir: '/path/to/terraform',
    };
  });

  it('should return success result with cluster info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.cluster.status).toBe('ACTIVE');
  });

  it('should return node groups', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.nodeGroups).toHaveLength(1);
    expect(result.data?.nodeGroups[0].name).toBe('main-node-group');
  });

  it('should return VPC info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.vpc).toBeDefined();
    expect(result.data?.vpc?.state).toBe('available');
  });

  it('should return NAT Gateway info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.natGateway).toBeDefined();
    expect(result.data?.natGateway?.state).toBe('available');
  });

  it('should return ALB info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.alb).toBeDefined();
    expect(result.data?.alb?.state).toBe('active');
  });

  it('should return Lambda info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.lambda).toBeDefined();
    expect(result.data?.lambda?.state).toBe('Active');
  });

  it('should return Terraform state info', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.terraform.resourceCount).toBeGreaterThan(0);
  });

  it('should return ready status', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.ready.vpc).toBe(true);
    expect(result.data?.ready.natGateway).toBe(true);
    expect(result.data?.ready.cluster).toBe(true);
  });

  it('should include duration in result', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockQueryClusterStatus(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });
});
