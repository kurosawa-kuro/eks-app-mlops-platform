#!/usr/bin/env npx tsx
/**
 * Terraform Status CLI
 *
 * Thin CLI wrapper that queries EKS cluster deployment status.
 *
 * Usage:
 *   npx tsx status.ts
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { QueryClusterStatus, type QueryClusterStatusOutput } from '../../usecases/cluster/QueryClusterStatus.js';
import { PATHS } from '../../config/paths.js';

const { log, c } = lib;

/**
 * Terraform Status Command
 */
class TerraformStatus extends InfraCommand {
  static name = 'status';
  static description = 'Show EKS deployment status';
  static commands = {
    status: { desc: 'Show deployment status', requireAws: true },
    help: { desc: 'Show help' },
  };

  async cmdStatus(): Promise<number> {
    console.log(c.bold(c.blue('EKS Deployment Status')));
    console.log(c.dim(new Date().toISOString()));

    const tfDir = PATHS.terraform.prod;
    const container = createInfraContainer(tfDir);
    const useCase = new QueryClusterStatus(container);

    const result = await useCase.execute({
      region: this.region,
      tfDir,
    });

    if (!result.success) {
      log.fail(result.error?.message || 'Failed to query status');
      return 1;
    }

    const data = result.data!;

    // AWS Account
    this.showSection('AWS Account');
    this.showInfo('Account ID', data.accountId);
    this.showInfo('Region', this.region);

    // EKS Cluster
    this.showSection('EKS Cluster');
    this.showInfo('Name', data.cluster.name);
    if (data.cluster.status !== 'NOT_FOUND') {
      const statusColor = data.cluster.status === 'ACTIVE' ? c.green : c.yellow;
      this.showInfo('Status', statusColor(data.cluster.status));
      this.showInfo('Version', data.cluster.version);
      this.showInfo('Endpoint', data.cluster.endpoint ? `${data.cluster.endpoint.substring(0, 50)}...` : null);
    } else {
      this.showInfo('Status', c.yellow('Not Created'));
    }

    // Node Groups
    this.showSection('Node Groups');
    if (data.nodeGroups.length === 0) {
      console.log(`  ${c.dim('No node groups')}`);
    } else {
      for (const ng of data.nodeGroups) {
        const statusColor = ng.status === 'ACTIVE' ? c.green : c.yellow;
        console.log(`  ${statusColor(ng.status)} ${ng.name} (desired: ${ng.desiredSize ?? 'N/A'})`);
      }
    }

    // VPC
    this.showSection('VPC');
    if (data.vpc) {
      const stateColor = data.vpc.state === 'available' ? c.green : c.yellow;
      console.log(`  ${stateColor(data.vpc.state)} ${data.vpc.id} (${data.vpc.cidr})`);
    } else {
      console.log(`  ${c.dim('No VPC found')}`);
    }

    // NAT Gateway
    this.showSection('NAT Gateway');
    if (data.natGateway) {
      const stateColor = data.natGateway.state === 'available' ? c.green : c.yellow;
      console.log(`  ${stateColor(data.natGateway.state)} ${data.natGateway.id}`);
    } else {
      console.log(`  ${c.dim('No NAT Gateway found')}`);
    }

    // Load Balancer
    this.showSection('Load Balancer');
    if (data.alb) {
      const stateColor = data.alb.state === 'active' ? c.green : c.yellow;
      console.log(`  ${stateColor(data.alb.state)} ${data.alb.name}`);
      if (data.alb.dnsName) {
        console.log(`    ${c.dim(`DNS: ${data.alb.dnsName}`)}`);
      }
    } else {
      console.log(`  ${c.dim('No ALB found')}`);
    }

    // Lambda
    this.showSection('Lambda Functions');
    if (data.lambda) {
      const stateColor = data.lambda.state === 'Active' ? c.green : c.yellow;
      console.log(`  ${stateColor(data.lambda.state)} ${data.lambda.name}`);
      if (data.lambda.runtime) {
        console.log(`    ${c.dim(`Runtime: ${data.lambda.runtime}`)}`);
      }
    } else {
      console.log(`  ${c.dim('Lambda not deployed')}`);
    }

    // Terraform State
    this.showSection('Terraform State');
    this.showInfo('Resources in state', data.terraform.resourceCount > 0 ? `${data.terraform.resourceCount} resources` : 'Empty');

    // Running Processes
    this.showSection('Running Processes');
    if (data.terraformRunning) {
      console.log(`  ${c.yellow('●')} Terraform apply running`);
    } else {
      console.log(`  ${c.dim('-')} No Terraform process`);
    }

    // Summary
    this.showSection('Summary');
    console.log(`  VPC:         ${data.ready.vpc ? c.green('Ready') : c.yellow('Pending')}`);
    console.log(`  NAT Gateway: ${data.ready.natGateway ? c.green('Ready') : c.yellow('Pending')}`);
    console.log(`  EKS Cluster: ${data.ready.cluster ? c.green('Ready') : c.yellow('Pending')}`);

    if (data.ready.cluster) {
      console.log(`\n${c.green(c.bold('Deployment Complete!'))}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Update kubeconfig: ${c.cyan('make eks-kubeconfig')}`);
      console.log(`  2. Deploy app:        ${c.cyan('make eks-k8s-deploy')}`);
      console.log(`  3. Check status:      ${c.cyan('make eks-k8s-status')}`);
    } else if (data.terraformRunning) {
      console.log(`\n${c.yellow('Deployment in progress...')}`);
      console.log(`\nMonitor with:`);
      console.log(`  ${c.cyan('tail -f /tmp/claude/tasks/*.output')}`);
    } else {
      console.log(`\n${c.yellow('Deployment not started or incomplete')}`);
      console.log(`\nStart deployment:`);
      console.log(`  ${c.cyan('make eks-deploy')}`);
    }

    console.log('');
    return 0;
  }

  private showSection(title: string): void {
    console.log(`\n${c.bold(c.cyan(`═══ ${title} ═══`))}`);
  }

  private showInfo(label: string, value: string | null | undefined): void {
    const v = value || c.dim('N/A');
    console.log(`  ${c.blue(`${label}:`)} ${v}`);
  }

}

TerraformStatus.main();
