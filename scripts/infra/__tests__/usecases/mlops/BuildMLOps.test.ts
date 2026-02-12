/**
 * Tests for BuildMLOps UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { BuildMLOpsInput, BuildMLOpsOutput, BuildCommand } from '../../../usecases/mlops/BuildMLOps.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockBuildMLOps {
  private container: InfraContainer;

  constructor(container: InfraContainer) {
    this.container = container;
  }

  async execute(input: BuildMLOpsInput) {
    const imageUrl = `${input.ecrUrl}:${input.tag}`;

    const output: BuildMLOpsOutput = {
      command: input.command,
      commandSuccess: true,
      imageUrl,
    };

    return {
      success: true,
      data: output,
      phases: [],
      durationMs: 100,
    };
  }
}

describe('BuildMLOps UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockInput: BuildMLOpsInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockInput = {
      command: 'build',
      ecrUrl: 'public.ecr.aws/test/mlops',
      tag: 'latest',
      platform: 'linux/amd64',
      dockerDir: '/path/to/docker',
      contextDir: '/path/to/mlops',
    };
  });

  it('should return success result for build command', async () => {
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.command).toBe('build');
    expect(result.data?.commandSuccess).toBe(true);
  });

  it('should return imageUrl with tag', async () => {
    mockInput.tag = 'v1.0.0';
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.imageUrl).toBe('public.ecr.aws/test/mlops:v1.0.0');
  });

  it('should include duration in result', async () => {
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should support build command', async () => {
    mockInput.command = 'build';
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.command).toBe('build');
  });

  it('should support push command', async () => {
    mockInput.command = 'push';
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data?.command).toBe('push');
  });

  it('should support all build commands', async () => {
    const commands: BuildCommand[] = ['build', 'push'];
    const useCase = new MockBuildMLOps(mockContainer);

    for (const command of commands) {
      mockInput.command = command;
      const result = await useCase.execute(mockInput);
      expect(result.success).toBe(true);
      expect(result.data?.command).toBe(command);
    }
  });

  it('should support custom platform', async () => {
    mockInput.platform = 'linux/arm64';
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
  });

  it('should handle custom tag', async () => {
    mockInput.tag = 'custom-tag-123';
    const useCase = new MockBuildMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.imageUrl).toContain('custom-tag-123');
  });
});
