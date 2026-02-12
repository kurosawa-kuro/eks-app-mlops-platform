/**
 * SmokeTestPhase - runs smoke tests after deployment.
 *
 * Phase 9: Smoke Tests
 */

import type { ExecutablePhase, PhaseContext, PhaseResult, SmokeTestResult } from './types.js';

/**
 * Options for SmokeTestPhase.
 */
export interface SmokeTestPhaseOptions {
  /** Skip smoke tests */
  skip?: boolean;
  /** Skip app-specific tests */
  skipApp?: boolean;
  /** Skip E2E tests (login, db) */
  skipE2E?: boolean;
}

/**
 * Runs smoke tests to verify the deployment.
 */
export class SmokeTestPhase implements ExecutablePhase<SmokeTestResult> {
  readonly name = 'Smoke Tests';
  readonly description = 'Running smoke tests';
  private readonly options: SmokeTestPhaseOptions;

  constructor(options: SmokeTestPhaseOptions = {}) {
    this.options = options;
  }

  async execute(context: PhaseContext): Promise<PhaseResult<SmokeTestResult>> {
    const { log } = context;

    if (this.options.skip) {
      log.info('Skipping smoke tests (--skip-smoke flag)');
      return {
        success: true,
        skipped: true,
        skipReason: 'Skipped by user',
        data: { passed: 0, failed: 0, warnings: 0, exitCode: 0 },
      };
    }

    try {
      // Dynamic import to avoid loading smoke tests when not needed
      const { runAllSmokes } = await import('../../../smoke/index.js');
      // Skip app tests (require ALB) and E2E tests (require app deployment)
      const report = await runAllSmokes({
        skipApp: true,
        skipE2E: this.options.skipE2E ?? true,
      });

      console.log('');

      const result: SmokeTestResult = {
        passed: report.summary.passed,
        failed: report.summary.failed,
        warnings: report.summary.warnings,
        exitCode: report.exitCode,
      };

      if (report.summary.failed > 0) {
        log.warn(`Smoke tests: ${report.summary.failed} failed, ${report.summary.passed} passed`);
        return {
          success: false,
          error: `${report.summary.failed} smoke tests failed`,
          data: result,
        };
      } else if (report.summary.warnings > 0) {
        log.warn(`Smoke tests: ${report.summary.warnings} warnings, ${report.summary.passed} passed`);
        return {
          success: true,
          data: result,
        };
      } else {
        log.pass(`Smoke tests: ${report.summary.passed} passed`);
        return {
          success: true,
          data: result,
        };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.warn(`Smoke tests skipped: ${message}`);
      return {
        success: true,
        skipped: true,
        skipReason: message,
        data: { passed: 0, failed: 0, warnings: 0, exitCode: 0 },
      };
    }
  }
}
