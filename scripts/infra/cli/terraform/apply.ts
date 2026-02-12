#!/usr/bin/env npx tsx
/**
 * Terraform Apply CLI
 *
 * Thin CLI wrapper that orchestrates EKS cluster provisioning using
 * the ProvisionCluster UseCase.
 *
 * Usage:
 *   npx tsx apply.ts [--timeout <seconds>] [--skip-apply] [--skip-smoke] [--no-log]
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { ProvisionCluster, type ProvisionClusterInput } from '../../usecases/cluster/ProvisionCluster.js';
import { Timer } from '../../framework/narrative/timer.js';
import { PATHS } from '../../config/paths.js';
import type { OptionDefinition } from '../../framework/types.js';

const { log, showContext, showOutcome, c } = lib;

/**
 * Terraform Apply Command
 *
 * Provisions an EKS cluster using the ProvisionCluster UseCase.
 */
class TerraformApply extends InfraCommand {
  static name = 'apply';
  static description = 'Provision EKS cluster with Terraform';
  static commands = {
    apply: { desc: 'Apply Terraform and provision cluster', requireAws: true },
    help: { desc: 'Show help' },
  };
  static options: Record<string, OptionDefinition> = {
    '--timeout': { name: 'timeout', type: 'string' as const, desc: 'Timeout in seconds' },
    '--skip-apply': { name: 'skipApply', type: 'boolean' as const, desc: 'Skip terraform apply' },
    '--skip-smoke': { name: 'skipSmoke', type: 'boolean' as const, desc: 'Skip smoke tests' },
    '--no-log': { name: 'noLog', type: 'boolean' as const, desc: 'Disable log file' },
  };

  async cmdApply(): Promise<number> {
    const timer = new Timer('eks-deploy').start();

    // Parse options
    const skipApply = this.options.skipApply === true;
    const skipSmoke = this.options.skipSmoke === true;
    const noLog = this.options.noLog === true;
    const tfDir = PATHS.terraform.prod;

    // Show context
    showContext('eks-deploy', {
      region: this.region,
      clusterName: 'prod-eks-cluster',
      mode: skipApply ? 'Skip Apply' : 'Full Deploy',
    });

    // Create container and use case
    const container = createInfraContainer(tfDir);
    const useCase = new ProvisionCluster(container);

    // Build input
    const input: ProvisionClusterInput = {
      overlay: 'prod',
      tfDir,
      region: this.region,
      skipApply,
      skipSmokeTests: skipSmoke,
      noLog,
    };

    // Execute
    const result = await useCase.execute(input);

    // Stop timer
    const timerResult = timer.stop(result.success);
    timer.save();

    // Show outcome
    if (result.success && result.data) {
      const summary: Array<{ label: string; value: string }> = [];
      if (result.data.clusterName) summary.push({ label: 'Cluster Name', value: result.data.clusterName });
      if (result.data.clusterVersion) summary.push({ label: 'Cluster Version', value: result.data.clusterVersion });
      if (result.data.endpoint) summary.push({ label: 'Endpoint', value: result.data.endpoint });
      if (result.data.vpcId) summary.push({ label: 'VPC ID', value: result.data.vpcId });

      const resources = result.data.nodes.map((node) => ({
        type: 'Node' as const,
        name: node.name || 'unknown',
        status: node.ready ? 'ready' as const : 'pending' as const,
        details: `${node.instanceType || 'unknown'}, ${node.zone || 'unknown'}`,
      }));

      console.log('');
      console.log(c.yellow('=== Private EKS Cluster ==='));
      console.log('kubectl access requires bastion host (SSM Session Manager)');

      showOutcome({
        success: true,
        title: 'Deployment Complete',
        duration: { startTime: timerResult.startTime, endTime: timerResult.endTime },
        phases: timerResult.phases.length > 0 ? timerResult.phases : undefined,
        summary,
        resources: resources.length > 0 ? resources : undefined,
        nextStepsPhaseId: 'eks-deploy',
      });

      return 0;
    } else {
      log.fail('Deployment failed');
      if (result.error) {
        log.fail(`Error: ${result.error.message}`);
      }
      return 1;
    }
  }
}

TerraformApply.main();
