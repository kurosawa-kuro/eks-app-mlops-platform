#!/usr/bin/env npx tsx
/**
 * EKS Full Deployment CLI
 *
 * Thin CLI wrapper for running all EKS deployment phases (1-9).
 *
 * Usage:
 *   npx tsx deploy-all.ts          # Run all phases
 *   npx tsx deploy-all.ts --dry-run # Show what would be done
 *   npx tsx deploy-all.ts --from=6  # Resume from Phase 6
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { DeployAll, DEFAULT_PHASES } from '../../usecases/deployment/DeployAll.js';

const { log, c } = lib;

/**
 * Full Deployment Command
 */
class DeployAllCommand extends InfraCommand {
  static name = 'deploy-all';
  static description = 'Run all EKS deployment phases';
  static commands = {
    run: { desc: 'Run deployment phases', requireAws: true },
    help: { desc: 'Show help' },
  };
  static options = {
    '--dry-run': { name: 'dryRun', type: 'boolean' as const },
    '--from': { name: 'from', type: 'string' as const },
  };

  async cmdRun(): Promise<number> {
    const dryRun = this.options.dryRun === true;
    const fromStr = this.options.from as string | undefined;
    const fromPhase = fromStr ? parseInt(fromStr, 10) : 1;

    console.log(c.bold('\n=== EKS Full Deployment ===\n'));

    if (dryRun) {
      log.info('Dry-run mode (no changes will be made)\n');
    }

    if (fromPhase > 1) {
      log.info(`Resuming from Phase ${fromPhase}\n`);
    }

    // Show phases that will be run
    const phasesToRun = DEFAULT_PHASES.filter((p) => p.num >= fromPhase);
    console.log(c.bold('Phases to run:'));
    for (const phase of phasesToRun) {
      console.log(`  ${phase.num}. ${phase.name} - ${phase.description}`);
    }
    console.log('');

    const container = createInfraContainer(process.cwd());
    const useCase = new DeployAll(container);

    const result = await useCase.execute({
      dryRun,
      fromPhase,
      cwd: process.cwd(),
    });

    if (!result.success) {
      log.fail(result.error?.message || 'Deployment failed');
      return 1;
    }

    const data = result.data!;

    // Show results
    console.log('');
    console.log(c.bold('Results:'));
    console.log(`  Phases run: ${data.phasesRun}`);
    console.log(`  Phases succeeded: ${data.phasesSucceeded}`);

    if (data.failedPhase) {
      log.fail(`Failed at Phase ${data.failedPhase}`);
      if (data.resumeHint) {
        console.log(c.yellow(`\nTo resume: ${data.resumeHint}`));
      }
      return 1;
    }

    log.pass('All phases completed successfully!');
    console.log(c.dim('\nVerify: make eks-verify'));
    return 0;
  }
}

DeployAllCommand.main();
