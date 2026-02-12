/**
 * Phase Value Object
 *
 * Represents a phase in a multi-step operation.
 * Follows the 起承転結 (ki-shō-ten-ketsu) narrative structure.
 */

export type PhaseStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Immutable value object representing an operation phase.
 *
 * @example
 * const phase = Phase.pending('Initialize', 'Initializing resources');
 * const running = phase.start();
 * const completed = running.succeed(1500);
 */
export class Phase {
  private constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly status: PhaseStatus,
    public readonly durationMs?: number,
    public readonly error?: string
  ) {}

  /**
   * Create a pending phase.
   */
  static pending(name: string, description: string): Phase {
    return new Phase(name, description, 'pending');
  }

  /**
   * Create a phase that has already completed.
   */
  static completed(name: string, description: string, durationMs: number): Phase {
    return new Phase(name, description, 'success', durationMs);
  }

  /**
   * Create a skipped phase.
   */
  static skipped(name: string, description: string, reason?: string): Phase {
    return new Phase(name, description, 'skipped', undefined, reason);
  }

  /**
   * Start this phase (transition to running).
   */
  start(): Phase {
    return new Phase(this.name, this.description, 'running');
  }

  /**
   * Mark this phase as succeeded.
   */
  succeed(durationMs: number): Phase {
    return new Phase(this.name, this.description, 'success', durationMs);
  }

  /**
   * Mark this phase as failed.
   */
  fail(error: string, durationMs?: number): Phase {
    return new Phase(this.name, this.description, 'failed', durationMs, error);
  }

  /**
   * Mark this phase as skipped.
   */
  skip(reason?: string): Phase {
    return new Phase(this.name, this.description, 'skipped', undefined, reason);
  }

  /**
   * Check if the phase is pending.
   */
  isPending(): boolean {
    return this.status === 'pending';
  }

  /**
   * Check if the phase is running.
   */
  isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Check if the phase succeeded.
   */
  isSuccess(): boolean {
    return this.status === 'success';
  }

  /**
   * Check if the phase failed.
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * Check if the phase was skipped.
   */
  isSkipped(): boolean {
    return this.status === 'skipped';
  }

  /**
   * Check if the phase is complete (success, failed, or skipped).
   */
  isComplete(): boolean {
    return this.status === 'success' || this.status === 'failed' || this.status === 'skipped';
  }

  /**
   * Get formatted duration string.
   */
  formatDuration(): string {
    if (this.durationMs === undefined) {
      return '-';
    }
    if (this.durationMs < 1000) {
      return `${this.durationMs}ms`;
    }
    const seconds = Math.round(this.durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}

/**
 * Narrative structure for operation phases.
 * Based on 起承転結 (ki-shō-ten-ketsu):
 * - 起 (ki): Introduction/Setup
 * - 承 (shō): Development/Main action
 * - 転 (ten): Turn/Transition/Wait
 * - 結 (ketsu): Conclusion/Verification
 */
export interface NarrativePhases {
  /** 起: Setup phase (preflight, validation) */
  setup: Phase[];
  /** 承: Main action phase (apply, deploy) */
  action: Phase[];
  /** 転: Transition phase (wait, monitor) */
  transition: Phase[];
  /** 結: Verification phase (smoke tests, health checks) */
  verification: Phase[];
}

/**
 * Create a narrative phases structure.
 */
export function createNarrativePhases(): NarrativePhases {
  return {
    setup: [],
    action: [],
    transition: [],
    verification: [],
  };
}

/**
 * Get all phases from a narrative structure as a flat array.
 */
export function flattenPhases(narrative: NarrativePhases): Phase[] {
  return [
    ...narrative.setup,
    ...narrative.action,
    ...narrative.transition,
    ...narrative.verification,
  ];
}
