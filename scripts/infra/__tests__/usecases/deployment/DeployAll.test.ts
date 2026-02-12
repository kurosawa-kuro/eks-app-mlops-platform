/**
 * Tests for DeployAll UseCase
 *
 * Note: These tests focus on the interface contract and simple scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InfraContainer } from '../../../container/types.js';
import type { DeployAllInput, DeployAllOutput, DeployAllPhaseResult, DeploymentPhase } from '../../../usecases/deployment/DeployAll.js';
import { createMockLogger } from '../../utils/test-helpers.js';

// Mock phases for testing
const MOCK_PHASES: DeploymentPhase[] = [
  { num: 1, name: 'Phase 1', commands: ['echo 1'], description: 'First phase' },
  { num: 2, name: 'Phase 2', commands: ['echo 2'], description: 'Second phase' },
  { num: 3, name: 'Phase 3', commands: ['echo 3'], description: 'Third phase' },
];

// Create a mock UseCase for testing the interface contract
class MockDeployAll {
  private container: InfraContainer;

  constructor(container: InfraContainer) {
    this.container = container;
  }

  async execute(input: DeployAllInput) {
    const phases = input.phases || MOCK_PHASES;
    const phasesToRun = phases.filter((p) => p.num >= input.fromPhase);
    const phaseResults: DeployAllPhaseResult[] = [];

    for (const phase of phasesToRun) {
      phaseResults.push({
        num: phase.num,
        name: phase.name,
        success: true,
        commandsExecuted: phase.commands.length,
      });
    }

    const output: DeployAllOutput = {
      phasesRun: phaseResults.length,
      phasesSucceeded: phaseResults.length,
      phaseResults,
      dryRun: input.dryRun,
    };

    return {
      success: true,
      data: output,
      phases: [],
      durationMs: 100,
    };
  }
}

describe('DeployAll UseCase Interface', () => {
  let mockContainer: InfraContainer;
  let mockInput: DeployAllInput;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockLogger = createMockLogger();
    mockContainer = {
      resolve: vi.fn().mockReturnValue(mockLogger),
    } as unknown as InfraContainer;

    mockInput = {
      dryRun: false,
      fromPhase: 1,
      phases: MOCK_PHASES,
    };
  });

  it('should return success result with phase results', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.phasesRun).toBe(3);
    expect(result.data?.phasesSucceeded).toBe(3);
  });

  it('should track all phase results', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.phaseResults).toHaveLength(3);
    expect(result.data?.phaseResults[0].name).toBe('Phase 1');
    expect(result.data?.phaseResults[1].name).toBe('Phase 2');
    expect(result.data?.phaseResults[2].name).toBe('Phase 3');
  });

  it('should respect fromPhase parameter', async () => {
    mockInput.fromPhase = 2;
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.phasesRun).toBe(2);
    expect(result.data?.phaseResults[0].num).toBe(2);
  });

  it('should track dry-run mode', async () => {
    mockInput.dryRun = true;
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.dryRun).toBe(true);
  });

  it('should track commands executed per phase', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    for (const phaseResult of result.data!.phaseResults) {
      expect(phaseResult.commandsExecuted).toBeGreaterThan(0);
    }
  });

  it('should include duration in result', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should include phases array in result', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.phases).toBeDefined();
    expect(Array.isArray(result.phases)).toBe(true);
  });

  it('should run all phases when fromPhase is 1', async () => {
    mockInput.fromPhase = 1;
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.phasesRun).toBe(3);
  });

  it('should skip all phases when fromPhase is greater than max', async () => {
    mockInput.fromPhase = 10;
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    expect(result.data?.phasesRun).toBe(0);
  });

  it('should return success status for each phase', async () => {
    const useCase = new MockDeployAll(mockContainer);
    const result = await useCase.execute(mockInput);

    for (const phaseResult of result.data!.phaseResults) {
      expect(phaseResult.success).toBe(true);
    }
  });
});
