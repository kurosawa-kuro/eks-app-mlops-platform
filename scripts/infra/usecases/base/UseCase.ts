/**
 * UseCase Base Class
 *
 * Provides the foundation for all use cases in the system.
 * Use cases follow the 起承転結 (ki-shō-ten-ketsu) narrative structure:
 * - 起 (ki): Introduction/Setup - preflight checks, validation
 * - 承 (shō): Development/Main action - terraform apply, deploy
 * - 転 (ten): Turn/Transition - wait for resources, monitor
 * - 結 (ketsu): Conclusion - verification, smoke tests
 */

import type { InfraContainer } from '../../container/types.js';
import { Phase, type NarrativePhases, createNarrativePhases, flattenPhases } from '../../domain/index.js';
import { DomainError } from '../../domain/errors/index.js';

/**
 * Result of a use case execution.
 */
export interface UseCaseResult<T> {
  /** Whether the use case succeeded */
  success: boolean;
  /** Output data from the use case */
  data?: T;
  /** Error if failed */
  error?: DomainError | Error;
  /** All phases that were executed */
  phases: Phase[];
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Base class for all use cases.
 *
 * @example
 * class ProvisionCluster extends UseCase<ProvisionClusterInput, ProvisionClusterOutput> {
 *   async execute(input: ProvisionClusterInput): Promise<UseCaseResult<ProvisionClusterOutput>> {
 *     // 起: Setup
 *     await this.runPhase('setup', 'Preflight', 'Running preflight checks', async () => {
 *       await this.container.resolve('preflightChecker').run();
 *     });
 *
 *     // 承: Action
 *     await this.runPhase('action', 'Terraform', 'Applying Terraform', async () => {
 *       await this.applyTerraform();
 *     });
 *
 *     // 転: Transition
 *     await this.runPhase('transition', 'Wait', 'Waiting for cluster', async () => {
 *       await this.waitForCluster();
 *     });
 *
 *     // 結: Verification
 *     await this.runPhase('verification', 'Smoke', 'Running smoke tests', async () => {
 *       await this.runSmokeTests();
 *     });
 *
 *     return this.buildResult({ clusterName: 'my-cluster' });
 *   }
 * }
 */
export abstract class UseCase<TInput, TOutput> {
  protected readonly narrative: NarrativePhases;
  protected startTime: number = 0;

  constructor(protected readonly container: InfraContainer) {
    this.narrative = createNarrativePhases();
  }

  /**
   * Execute the use case.
   */
  abstract execute(input: TInput): Promise<UseCaseResult<TOutput>>;

  /**
   * Start timing the use case.
   */
  protected startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds.
   */
  protected getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Run a phase and track its execution.
   *
   * @param section - Which narrative section this phase belongs to
   * @param name - Phase name
   * @param description - Phase description
   * @param action - The async action to run
   * @returns The completed phase
   */
  protected async runPhase(
    section: keyof NarrativePhases,
    name: string,
    description: string,
    action: () => Promise<void>
  ): Promise<Phase> {
    const phaseStart = Date.now();
    let phase = Phase.pending(name, description).start();
    this.narrative[section].push(phase);

    try {
      await action();
      const duration = Date.now() - phaseStart;
      phase = phase.succeed(duration);
      // Update the phase in the narrative
      const index = this.narrative[section].length - 1;
      this.narrative[section][index] = phase;
      return phase;
    } catch (error) {
      const duration = Date.now() - phaseStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      phase = phase.fail(errorMessage, duration);
      // Update the phase in the narrative
      const index = this.narrative[section].length - 1;
      this.narrative[section][index] = phase;
      throw error;
    }
  }

  /**
   * Skip a phase with a reason.
   */
  protected skipPhase(
    section: keyof NarrativePhases,
    name: string,
    description: string,
    reason: string
  ): Phase {
    const phase = Phase.skipped(name, description, reason);
    this.narrative[section].push(phase);
    return phase;
  }

  /**
   * Build the final result.
   */
  protected buildResult(data?: TOutput): UseCaseResult<TOutput> {
    const phases = flattenPhases(this.narrative);
    const success = phases.every(p => p.isSuccess() || p.isSkipped());

    return {
      success,
      data,
      phases,
      durationMs: this.getElapsedMs(),
    };
  }

  /**
   * Build a failed result.
   */
  protected buildFailedResult(error: Error | DomainError): UseCaseResult<TOutput> {
    const phases = flattenPhases(this.narrative);

    return {
      success: false,
      error,
      phases,
      durationMs: this.getElapsedMs(),
    };
  }

  /**
   * Get all phases as a flat array.
   */
  protected getPhases(): Phase[] {
    return flattenPhases(this.narrative);
  }

  /**
   * Check if any phase has failed.
   */
  protected hasFailedPhase(): boolean {
    return this.getPhases().some(p => p.isFailed());
  }
}

/**
 * Helper to wrap use case execution with standard error handling.
 */
export async function executeUseCase<TInput, TOutput>(
  useCase: UseCase<TInput, TOutput>,
  input: TInput
): Promise<UseCaseResult<TOutput>> {
  try {
    return await useCase.execute(input);
  } catch (error) {
    // Re-throw domain errors as they are
    if (error instanceof DomainError) {
      throw error;
    }
    // Wrap other errors
    throw error;
  }
}
