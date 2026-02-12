#!/usr/bin/env npx tsx
/**
 * Terraform Destroy CLI
 *
 * Thin CLI wrapper that orchestrates EKS cluster destruction using
 * the DestroyCluster UseCase.
 *
 * Usage:
 *   npx tsx destroy.ts [--dry-run] [--skip-k8s] [--skip-terraform] [--force]
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { DestroyCluster } from '../../usecases/cluster/DestroyCluster.js';
import { PATHS } from '../../config/paths.js';
import { createConfig } from '../../config/index.js';
import type { OptionDefinition } from '../../framework/types.js';

const { log, c, confirm } = lib;
const sharedConfig = createConfig();

/**
 * Terraform Destroy Command
 */
class TerraformDestroy extends InfraCommand {
  static name = 'destroy';
  static description = 'Destroy EKS cluster and cleanup resources';
  static commands = {
    destroy: { desc: 'Destroy EKS infrastructure', requireAws: true },
    help: { desc: 'Show help' },
  };
  static options: Record<string, OptionDefinition> = {
    '--dry-run': { name: 'dryRun', type: 'boolean' as const, desc: 'Dry run mode - no changes' },
    '--skip-k8s': { name: 'skipK8s', type: 'boolean' as const, desc: 'Skip K8s cleanup' },
    '--skip-terraform': { name: 'skipTerraform', type: 'boolean' as const, desc: 'Skip terraform destroy' },
    '--force': { name: 'force', type: 'boolean' as const, desc: 'Skip confirmations' },
  };

  async cmdDestroy(): Promise<number> {
    const dryRun = this.options.dryRun === true;
    const skipK8s = this.options.skipK8s === true;
    const skipTerraform = this.options.skipTerraform === true;
    const force = this.options.force === true;
    const tfDir = PATHS.terraform.prod;
    const clusterName = sharedConfig.clusterName || 'prod-eks-cluster';

    // Warning banner
    console.log('');
    console.log(c.bold(c.red('==============================================================')));
    console.log(c.bold(c.red('          PRODUCTION EKS INFRASTRUCTURE DESTROY              ')));
    console.log(c.bold(c.red('==============================================================')));
    console.log('');

    if (dryRun) console.log(c.magenta('  DRY-RUN MODE - No changes will be made'));
    console.log(`  Cluster: ${c.cyan(clusterName)}`);
    console.log(`  Region:  ${c.cyan(this.region)}`);
    console.log('');

    // Confirmation
    if (!dryRun && !force) {
      console.log(c.red(c.bold('  WARNING: This will PERMANENTLY destroy all infrastructure!')));
      console.log('');
      const confirmed = await confirm('Are you sure you want to proceed?');
      if (!confirmed) {
        log.info('Destruction cancelled');
        return 0;
      }
    }

    const container = createInfraContainer(tfDir);
    const useCase = new DestroyCluster(container);

    const result = await useCase.execute({
      dryRun,
      skipK8s,
      skipTerraform,
      force,
      tfDir,
      region: this.region,
      clusterName,
    });

    if (!result.success) {
      log.fail(result.error?.message || 'Destroy failed');
      return 1;
    }

    const data = result.data!;

    // Summary
    console.log('');
    console.log(c.bold('=============================================================='));
    console.log(c.bold(' Destroy Summary'));
    console.log(c.bold('=============================================================='));
    console.log('');
    console.log(`  ${dryRun ? c.magenta('Mode:') : c.green('Mode:')} ${dryRun ? 'DRY-RUN' : 'Actual destruction'}`);
    console.log(`  ${c.cyan('Resources deleted:')} ${data.resourcesDeleted}`);
    console.log(`  ${c.cyan('Duration:')} ${data.durationSeconds} seconds`);
    console.log('');

    if (dryRun) {
      console.log(c.yellow('To perform actual destruction, run without --dry-run'));
    } else {
      console.log(c.green('Destruction completed successfully'));
    }

    return 0;
  }
}

TerraformDestroy.main();
