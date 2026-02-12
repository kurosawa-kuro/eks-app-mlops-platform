/**
 * PreflightPhase - validates prerequisites before provisioning.
 *
 * Phase 1: Pre-flight Checks
 * Checks:
 * - AWS CLI availability
 * - AWS credentials validity
 * - kubectl availability
 * - Terraform initialization
 */

import { run as defaultRun } from '../../../infrastructure/shell/exec.js';
import { c } from '../../../framework/logging/colors.js';
import type { ExecutablePhase, PhaseContext, PhaseResult, PreflightResult } from './types.js';

/**
 * Dependencies for PreflightPhase.
 */
export interface PreflightPhaseDependencies {
  run: typeof defaultRun;
}

const defaultDeps: PreflightPhaseDependencies = {
  run: defaultRun,
};

/**
 * Validates prerequisites before starting the provisioning workflow.
 */
export class PreflightPhase implements ExecutablePhase<PreflightResult> {
  readonly name = 'Preflight';
  readonly description = 'Running preflight checks';
  private readonly deps: PreflightPhaseDependencies;

  constructor(deps: Partial<PreflightPhaseDependencies> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  async execute(context: PhaseContext): Promise<PhaseResult<PreflightResult>> {
    const { log, tfDir } = context;
    let hasKubectl = false;
    let tfInitialized = false;

    // Check AWS CLI
    const awsOk = this.check('AWS CLI', () => {
      this.deps.run('which aws');
      return {};
    });
    if (!awsOk) {
      return {
        success: false,
        error: 'AWS CLI not found',
        data: { passed: false, hasKubectl: false, tfInitialized: false },
      };
    }

    // Check AWS credentials
    const credsOk = this.check('AWS credentials', () => {
      const accountId = this.deps.run('aws sts get-caller-identity --query Account --output text');
      return { info: `Account: ${accountId}` };
    });
    if (!credsOk) {
      return {
        success: false,
        error: 'AWS credentials invalid or expired',
        data: { passed: false, hasKubectl: false, tfInitialized: false },
      };
    }

    // Check kubectl (optional)
    hasKubectl = this.check('kubectl', () => {
      this.deps.run('which kubectl');
      return {};
    });

    // Check Terraform initialization
    tfInitialized = this.check('Terraform initialization', () => {
      const result = this.deps.run('ls -la .terraform', { cwd: tfDir, ignoreError: true });
      if (!result) {
        throw new Error('Not initialized');
      }
      return {};
    });

    log.pass('Preflight checks completed');
    return {
      success: true,
      data: { passed: true, hasKubectl, tfInitialized },
    };
  }

  /**
   * Run a single check with formatted output.
   */
  private check(name: string, fn: () => { info?: string }): boolean {
    process.stdout.write(`Checking ${name}... `);
    try {
      const result = fn();
      console.log(c.green('OK') + (result.info ? ` (${result.info})` : ''));
      return true;
    } catch {
      console.log(c.red('FAILED'));
      return false;
    }
  }
}
