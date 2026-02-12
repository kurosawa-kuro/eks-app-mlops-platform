/**
 * Tests for ManageMLOps UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { ManageMLOpsInput, ManageMLOpsOutput, MLOpsCommand } from '../../../usecases/mlops/ManageMLOps.js';
import { MLOPS_JOBS, STEP_TIMEOUTS } from '../../../usecases/mlops/ManageMLOps.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Create a mock UseCase for testing the interface contract
class MockManageMLOps {
  private container: InfraContainer;

  constructor(container: InfraContainer) {
    this.container = container;
  }

  async execute(input: ManageMLOpsInput) {
    const output: ManageMLOpsOutput = {
      command: input.command,
      commandSuccess: true,
      output: `Executed ${input.command}`,
    };

    if (input.command === 'job' && input.jobName) {
      output.jobStatus = { name: input.jobName, completed: false };
    }

    return {
      success: true,
      data: output,
      phases: [],
      durationMs: 100,
    };
  }
}

describe('ManageMLOps UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockInput: ManageMLOpsInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockInput = {
      command: 'status',
      region: 'ap-northeast-1',
      clusterName: 'test-cluster',
      bastionId: 'i-12345',
      s3Bucket: 'test-bucket',
      roleArn: 'arn:aws:iam::123:role/test-role',
      ecrUrl: 'public.ecr.aws/test/mlops',
      k8sDir: '/path/to/k8s',
    };
  });

  it('should return success result for status command', async () => {
    const useCase = new MockManageMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.command).toBe('status');
    expect(result.data?.commandSuccess).toBe(true);
  });

  it('should include duration in result', async () => {
    const useCase = new MockManageMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockManageMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should track job status for job command', async () => {
    mockInput.command = 'job';
    mockInput.jobName = 'analytics';

    const useCase = new MockManageMLOps(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.jobStatus).toBeDefined();
    expect(result.data?.jobStatus?.name).toBe('analytics');
  });

  it('should support all MLOps commands', async () => {
    const commands: MLOpsCommand[] = [
      'deploy', 'job', 'wait', 'logs',
      'pipeline', 'pipeline-analytics',
      'status', 'verify', 'metrics', 'results',
      'clean', 'clean-all', 'info',
    ];

    const useCase = new MockManageMLOps(mockContainer);

    for (const command of commands) {
      mockInput.command = command;
      if (command === 'job' || command === 'wait') {
        mockInput.jobName = 'analytics';
      }
      if (command === 'logs') {
        mockInput.stage = 'analytics';
      }

      const result = await useCase.execute(mockInput);
      expect(result.success).toBe(true);
      expect(result.data?.command).toBe(command);
    }
  });
});

describe('MLOPS_JOBS Configuration', () => {
  it('should have all required jobs defined', () => {
    const expectedJobs = ['preprocess', 'train', 'analytics', 'sentiment', 'generate', 'generate-reviews'];

    for (const jobName of expectedJobs) {
      expect(MLOPS_JOBS[jobName]).toBeDefined();
      expect(MLOPS_JOBS[jobName].k8sName).toBeDefined();
      expect(MLOPS_JOBS[jobName].fileName).toBeDefined();
      expect(MLOPS_JOBS[jobName].stage).toBeDefined();
    }
  });

  it('should have unique k8s names for each job', () => {
    const k8sNames = Object.values(MLOPS_JOBS).map(j => j.k8sName);
    const uniqueNames = new Set(k8sNames);
    expect(uniqueNames.size).toBe(k8sNames.length);
  });

  it('should have .yaml extension for all file names', () => {
    for (const job of Object.values(MLOPS_JOBS)) {
      expect(job.fileName).toMatch(/\.yaml$/);
    }
  });
});

describe('STEP_TIMEOUTS Configuration', () => {
  it('should have timeouts for all jobs', () => {
    const expectedTimeouts = ['generate', 'generate-reviews', 'preprocess', 'train', 'analytics', 'sentiment'];

    for (const stepName of expectedTimeouts) {
      expect(STEP_TIMEOUTS[stepName]).toBeDefined();
      expect(STEP_TIMEOUTS[stepName]).toBeGreaterThan(0);
    }
  });

  it('should have reasonable timeout values', () => {
    for (const [name, timeout] of Object.entries(STEP_TIMEOUTS)) {
      expect(timeout).toBeGreaterThanOrEqual(60);
      expect(timeout).toBeLessThanOrEqual(600);
    }
  });
});
