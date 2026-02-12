#!/usr/bin/env npx tsx
/**
 * EKS Management Script
 * Manage Amazon EKS clusters: list, show, update-kubeconfig
 *
 * CRUD Policy:
 * - Create: ❌ (Terraform responsibility - tf-deploy.ts)
 * - Read:   ✅ list, show
 * - Update: ✅ update-kubeconfig only (safe logical operation)
 * - Delete: ❌ (Terraform responsibility - tf-destroy.ts)
 */

import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type {
  EKSListClustersResult,
  EKSDescribeClusterResult,
  EKSListNodeGroupsResult,
  EKSDescribeNodeGroupResult,
  EKSCluster,
  EKSNodeGroup,
} from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

class EksManage extends AwsCommand {
  static override name = 'eks-manage';
  static service = 'eks';
  static override description = 'EKS Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List EKS clusters', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show cluster details', args: '<cluster-name>', aliases: ['info'], requireAws: true },
    'update-kubeconfig': { desc: 'Update kubeconfig for cluster', args: '<cluster-name>', aliases: ['kubeconfig'], requireAws: true },
    nodegroups: { desc: 'List node groups in cluster', args: '<cluster-name>', aliases: ['ng'], requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--alias': { name: 'alias', type: 'string', desc: 'Alias name for kubeconfig context' },
  };

  // ============================================================
  // Helper Methods
  // ============================================================

  private listClusters(): string[] {
    const result = this.awsJson<EKSListClustersResult>('eks list-clusters', {
      ignoreError: true,
      defaultValue: { clusters: [] },
    });
    return result.clusters || [];
  }

  private getCluster(clusterName: string): EKSCluster | null {
    try {
      const result = this.awsJson<EKSDescribeClusterResult>(
        `eks describe-cluster --name ${clusterName}`
      );
      return result.cluster || null;
    } catch {
      return null;
    }
  }

  private listNodeGroups(clusterName: string): string[] {
    const result = this.awsJson<EKSListNodeGroupsResult>(
      `eks list-nodegroups --cluster-name ${clusterName}`,
      { ignoreError: true, defaultValue: { nodegroups: [] } }
    );
    return result.nodegroups || [];
  }

  private getNodeGroup(clusterName: string, nodegroupName: string): EKSNodeGroup | null {
    try {
      const result = this.awsJson<EKSDescribeNodeGroupResult>(
        `eks describe-nodegroup --cluster-name ${clusterName} --nodegroup-name ${nodegroupName}`
      );
      return result.nodegroup || null;
    } catch {
      return null;
    }
  }

  private formatStatus(status: string | undefined): string {
    if (!status) return lib.c.dim('unknown');
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return lib.c.green(status);
      case 'CREATING':
      case 'UPDATING':
        return lib.c.yellow(status);
      case 'DELETING':
      case 'FAILED':
        return lib.c.red(status);
      default:
        return lib.c.dim(status);
    }
  }

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('EKS Clusters');
    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const clusters = this.listClusters();

    if (clusters.length === 0) {
      lib.log.info('No clusters found');
      return 0;
    }

    lib.log.pass(`Found ${clusters.length} cluster(s)`);
    console.log('');

    const rows: string[][] = [];
    for (const clusterName of clusters) {
      const cluster = this.getCluster(clusterName);
      if (cluster) {
        rows.push([
          cluster.name,
          this.formatStatus(cluster.status),
          cluster.version || '-',
          cluster.platformVersion || '-',
          lib.formatDate(cluster.createdAt),
        ]);
      } else {
        rows.push([clusterName, '-', '-', '-', '-']);
      }
    }

    this.formatTable(
      ['NAME', 'STATUS', 'VERSION', 'PLATFORM', 'CREATED'],
      rows,
      [25, 12, 10, 15, 20]
    );

    return 0;
  }

  async cmdShow(clusterName?: string): Promise<number> {
    if (!clusterName) {
      lib.log.fail('Cluster name is required');
      console.log('');
      console.log('Usage: npx tsx eks-manage.ts show <cluster-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(clusterName, 'cluster'))) {
      return 1;
    }

    lib.log.header(`EKS Cluster: ${clusterName}`);

    const cluster = this.getCluster(clusterName);

    if (!cluster) {
      lib.log.fail(`Cluster '${clusterName}' not found`);
      return 1;
    }

    lib.log.section('Cluster Information');
    console.log(`  Name:             ${cluster.name}`);
    console.log(`  Status:           ${this.formatStatus(cluster.status)}`);
    console.log(`  Version:          ${cluster.version || '-'}`);
    console.log(`  Platform:         ${cluster.platformVersion || '-'}`);
    console.log(`  Created:          ${lib.formatDate(cluster.createdAt)}`);

    lib.log.section('Endpoint');
    console.log(`  URL:              ${cluster.endpoint || '-'}`);
    console.log(`  Public Access:    ${cluster.resourcesVpcConfig?.endpointPublicAccess ?? '-'}`);
    console.log(`  Private Access:   ${cluster.resourcesVpcConfig?.endpointPrivateAccess ?? '-'}`);

    lib.log.section('VPC Configuration');
    console.log(`  VPC ID:           ${cluster.resourcesVpcConfig?.vpcId || '-'}`);
    const subnets = cluster.resourcesVpcConfig?.subnetIds || [];
    console.log(`  Subnets:          ${subnets.length > 0 ? subnets.join(', ') : '-'}`);

    // Node groups
    lib.log.section('Node Groups');
    const nodegroups = this.listNodeGroups(clusterName);

    if (nodegroups.length === 0) {
      lib.log.info('No node groups');
    } else {
      for (const ngName of nodegroups) {
        const ng = this.getNodeGroup(clusterName, ngName);
        if (ng) {
          const scaling = ng.scalingConfig;
          const size = scaling ? `${scaling.desiredSize}/${scaling.minSize}-${scaling.maxSize}` : '-';
          console.log(`  ${ngName}: ${this.formatStatus(ng.status)} [${ng.capacityType || '-'}] ${size}`);
        } else {
          console.log(`  ${ngName}: -`);
        }
      }
    }

    // Usage hints
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Update kubeconfig:  npx tsx aws/eks-manage.ts update-kubeconfig ${clusterName}`);
    lib.log.info(`  Node groups:        npx tsx aws/eks-manage.ts nodegroups ${clusterName}`);

    return 0;
  }

  async cmdUpdateKubeconfig(clusterName?: string): Promise<number> {
    if (!clusterName) {
      lib.log.fail('Cluster name is required');
      console.log('');
      console.log('Usage: npx tsx eks-manage.ts update-kubeconfig <cluster-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(clusterName, 'cluster'))) {
      return 1;
    }

    lib.log.header(`Update Kubeconfig: ${clusterName}`);

    // Check cluster exists
    const cluster = this.getCluster(clusterName);
    if (!cluster) {
      lib.log.fail(`Cluster '${clusterName}' not found`);
      return 1;
    }

    if (cluster.status !== 'ACTIVE') {
      lib.log.warn(`Cluster status is ${cluster.status} (not ACTIVE)`);
    }

    lib.log.info(`Cluster: ${clusterName}`);
    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Endpoint: ${cluster.endpoint || '-'}`);
    console.log('');

    // Build command
    let cmd = `eks update-kubeconfig --name ${clusterName}`;
    if (this.options.alias && typeof this.options.alias === 'string') {
      cmd += ` --alias ${this.options.alias}`;
      lib.log.info(`Context alias: ${this.options.alias}`);
    }

    lib.log.section('Updating Kubeconfig');

    try {
      const output = this.awsExec(cmd);
      lib.log.pass('Kubeconfig updated');
      if (output) {
        console.log(output);
      }

      // Verify connection
      console.log('');
      lib.log.section('Verifying Connection');

      try {
        const nodesOutput = lib.run('kubectl get nodes --no-headers 2>/dev/null', {
          ignoreError: true,
          silent: true,
        });

        if (nodesOutput) {
          const nodeCount = nodesOutput.trim().split('\n').filter(Boolean).length;
          lib.log.pass(`Connected! ${nodeCount} node(s) found`);
        } else {
          lib.log.warn('Could not verify connection (kubectl may not be available)');
        }
      } catch {
        lib.log.warn('Could not verify connection');
      }

      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to update kubeconfig: ${toError(error).message}`);
      console.log('');
      lib.log.info('Troubleshooting:');
      console.log('  1. Verify AWS credentials are configured');
      console.log('  2. Check IAM permissions for eks:DescribeCluster');
      console.log('  3. For private clusters, ensure network connectivity');
      return 1;
    }
  }

  async cmdNodegroups(clusterName?: string): Promise<number> {
    if (!clusterName) {
      lib.log.fail('Cluster name is required');
      console.log('');
      console.log('Usage: npx tsx eks-manage.ts nodegroups <cluster-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(clusterName, 'cluster'))) {
      return 1;
    }

    lib.log.header(`Node Groups: ${clusterName}`);

    // Check cluster exists
    const cluster = this.getCluster(clusterName);
    if (!cluster) {
      lib.log.fail(`Cluster '${clusterName}' not found`);
      return 1;
    }

    const nodegroups = this.listNodeGroups(clusterName);

    if (nodegroups.length === 0) {
      lib.log.info('No node groups found');
      return 0;
    }

    lib.log.pass(`Found ${nodegroups.length} node group(s)`);
    console.log('');

    const rows: string[][] = [];
    for (const ngName of nodegroups) {
      const ng = this.getNodeGroup(clusterName, ngName);
      if (ng) {
        const scaling = ng.scalingConfig;
        rows.push([
          ng.nodegroupName || ngName,
          this.formatStatus(ng.status),
          ng.capacityType || '-',
          ng.instanceTypes?.join(', ') || '-',
          scaling ? `${scaling.desiredSize}` : '-',
          scaling ? `${scaling.minSize}-${scaling.maxSize}` : '-',
        ]);
      } else {
        rows.push([ngName, '-', '-', '-', '-', '-']);
      }
    }

    this.formatTable(
      ['NAME', 'STATUS', 'CAPACITY', 'INSTANCE TYPES', 'DESIRED', 'MIN-MAX'],
      rows,
      [25, 12, 12, 25, 8, 10]
    );

    return 0;
  }
}

// Only run main() if this file is executed directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  EksManage.main();
}
