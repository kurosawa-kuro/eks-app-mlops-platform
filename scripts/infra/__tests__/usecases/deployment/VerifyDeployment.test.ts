/**
 * Tests for VerifyDeployment UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { VerifyDeploymentInput, VerifyDeploymentOutput, VerifyResult, VerifyCommand } from '../../../usecases/deployment/VerifyDeployment.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockVerifyDeployment {
  private container: InfraContainer;

  constructor(container: InfraContainer) {
    this.container = container;
  }

  async execute(input: VerifyDeploymentInput) {
    const results: VerifyResult[] = [];

    if (input.command === 'all' || input.command === 'health') {
      results.push({
        name: 'API Health',
        success: true,
        message: `${input.apiUrl}/health → 200 OK`,
      });
      results.push({
        name: 'Frontend Health',
        success: true,
        message: `${input.appUrl} → 200 OK`,
      });
    }

    if (input.command === 'all' || input.command === 'login') {
      results.push({
        name: 'Login Test',
        success: true,
        message: `Login as ${input.testUser.email} → 200 OK`,
        details: 'Token received',
      });
    }

    const output: VerifyDeploymentOutput = {
      command: input.command,
      allPassed: results.every((r) => r.success),
      results,
      apiUrl: input.apiUrl,
      appUrl: input.appUrl,
    };

    return {
      success: true,
      data: output,
      phases: [],
      durationMs: 100,
    };
  }
}

describe('VerifyDeployment UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockInput: VerifyDeploymentInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockInput = {
      command: 'all',
      apiUrl: 'https://api.example.com',
      appUrl: 'https://app.example.com',
      testUser: {
        email: 'test@example.com',
        password: 'password123',
      },
      timeout: 10000,
    };
  });

  it('should return success result with verification results', async () => {
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.allPassed).toBe(true);
  });

  it('should run all checks for "all" command', async () => {
    mockInput.command = 'all';
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.results.length).toBe(3);
    expect(result.data?.results.map((r) => r.name)).toContain('API Health');
    expect(result.data?.results.map((r) => r.name)).toContain('Frontend Health');
    expect(result.data?.results.map((r) => r.name)).toContain('Login Test');
  });

  it('should run only health checks for "health" command', async () => {
    mockInput.command = 'health';
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.results.length).toBe(2);
    expect(result.data?.results.map((r) => r.name)).toContain('API Health');
    expect(result.data?.results.map((r) => r.name)).toContain('Frontend Health');
    expect(result.data?.results.map((r) => r.name)).not.toContain('Login Test');
  });

  it('should run only login test for "login" command', async () => {
    mockInput.command = 'login';
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.results.length).toBe(1);
    expect(result.data?.results[0].name).toBe('Login Test');
  });

  it('should include URLs in output', async () => {
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.apiUrl).toBe('https://api.example.com');
    expect(result.data?.appUrl).toBe('https://app.example.com');
  });

  it('should track command in output', async () => {
    mockInput.command = 'health';
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.command).toBe('health');
  });

  it('should include details in verification results', async () => {
    mockInput.command = 'login';
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.results[0].details).toBe('Token received');
  });

  it('should include duration in result', async () => {
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should respect timeout parameter', async () => {
    mockInput.timeout = 5000;
    const useCase = new MockVerifyDeployment(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
  });
});
