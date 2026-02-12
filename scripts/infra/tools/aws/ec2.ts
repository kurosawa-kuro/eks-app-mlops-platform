#!/usr/bin/env npx tsx
/**
 * EC2 Management Script
 * Manage Amazon EC2 instances: list, show, start, stop
 *
 * CRUD Policy:
 * - Create: ❌ (Terraform responsibility)
 * - Read:   ✅ list, show
 * - Update: ✅ start, stop (limited to safe operations)
 * - Delete: ❌ (Terraform responsibility)
 */

import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import {
  toError,
  safeParseJson,
  EC2InstanceQuerySchema,
  EC2AMISchema,
  ASGInstancesSchema,
} from '../../infrastructure/types.js';
import type {
  EC2Instance,
  EC2DescribeInstancesResult,
} from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

class Ec2Manage extends AwsCommand {
  static override name = 'ec2-manage';
  static service = 'ec2';
  static override description = 'EC2 Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List EC2 instances', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show instance details', args: '<instance-id>', aliases: ['info'], requireAws: true },
    start: { desc: 'Start an instance', args: '<instance-id>', requireAws: true },
    stop: { desc: 'Stop an instance', args: '<instance-id>', requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--only-running': { name: 'onlyRunning', type: 'boolean', desc: 'Show only running instances' },
    '--filter': { name: 'filter', type: 'string', desc: 'Filter by tag (format: tag=Key=Value)' },
    '--force': { name: 'force', type: 'boolean', desc: 'Skip confirmation prompt' },
  };

  // ============================================================
  // Helper Methods
  // ============================================================

  private getTagValue(instance: EC2Instance, key: string): string {
    const tag = instance.Tags?.find((t) => t.Key === key);
    return tag?.Value || '';
  }

  private getInstances(): EC2Instance[] {
    const filters: string[] = [];

    // Only running filter
    if (this.options.onlyRunning) {
      filters.push('Name=instance-state-name,Values=running');
    }

    // Custom tag filter
    if (this.options.filter && typeof this.options.filter === 'string') {
      const match = this.options.filter.match(/^tag=(.+)=(.+)$/);
      if (match) {
        filters.push(`Name=tag:${match[1]},Values=${match[2]}`);
      }
    }

    const filterArg = filters.length > 0 ? `--filters ${filters.join(' ')}` : '';
    const result = this.awsJson<EC2DescribeInstancesResult>(
      `ec2 describe-instances ${filterArg}`,
      { ignoreError: true, defaultValue: { Reservations: [] } }
    );

    const instances: EC2Instance[] = [];
    for (const reservation of result.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        instances.push(instance);
      }
    }

    return instances;
  }

  private getInstance(instanceId: string): EC2Instance | null {
    const result = this.awsJson<EC2DescribeInstancesResult>(
      `ec2 describe-instances --instance-ids ${instanceId}`,
      { ignoreError: true, defaultValue: { Reservations: [] } }
    );

    return result.Reservations?.[0]?.Instances?.[0] || null;
  }

  private formatState(state: string): string {
    switch (state) {
      case 'running':
        return lib.c.green(state);
      case 'stopped':
        return lib.c.red(state);
      case 'pending':
      case 'stopping':
        return lib.c.yellow(state);
      default:
        return lib.c.dim(state);
    }
  }

  private isSafeToModify(instance: EC2Instance): boolean {
    // Only allow modification of bastion instances
    const name = this.getTagValue(instance, 'Name').toLowerCase();
    return name.includes('bastion');
  }

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('EC2 Instances');
    lib.log.info(`Region: ${this.region}`);
    if (this.options.onlyRunning) {
      lib.log.info('Filter: running only');
    }
    if (this.options.filter) {
      lib.log.info(`Filter: ${this.options.filter}`);
    }
    console.log('');

    const instances = this.getInstances();

    if (instances.length === 0) {
      lib.log.info('No instances found');
      return 0;
    }

    lib.log.pass(`Found ${instances.length} instance(s)`);
    console.log('');

    const rows = instances.map((instance) => [
      instance.InstanceId,
      this.getTagValue(instance, 'Name') || '-',
      this.formatState(instance.State?.Name || 'unknown'),
      instance.InstanceType || '-',
      instance.Placement?.AvailabilityZone || '-',
      instance.PrivateIpAddress || '-',
    ]);

    this.formatTable(
      ['INSTANCE ID', 'NAME', 'STATE', 'TYPE', 'AZ', 'PRIVATE IP'],
      rows,
      [22, 25, 12, 12, 15, 16]
    );

    return 0;
  }

  async cmdShow(instanceId?: string): Promise<number> {
    if (!instanceId) {
      lib.log.fail('Instance ID is required');
      console.log('');
      console.log('Usage: npx tsx ec2-manage.ts show <instance-id>');
      return 1;
    }

    // Validate instance ID format (i-xxxxxxxxxxxxxxxxx)
    if (!/^i-[a-f0-9]{8,17}$/.test(instanceId)) {
      lib.log.fail('Invalid instance ID format');
      return 1;
    }

    lib.log.header(`EC2 Instance: ${instanceId}`);

    const instance = this.getInstance(instanceId);

    if (!instance) {
      lib.log.fail(`Instance '${instanceId}' not found`);
      return 1;
    }

    lib.log.section('Instance Information');
    console.log(`  Instance ID:    ${instance.InstanceId}`);
    console.log(`  Name:           ${this.getTagValue(instance, 'Name') || '-'}`);
    console.log(`  State:          ${this.formatState(instance.State?.Name || 'unknown')}`);
    console.log(`  Type:           ${instance.InstanceType || '-'}`);
    console.log(`  AZ:             ${instance.Placement?.AvailabilityZone || '-'}`);
    console.log(`  Private IP:     ${instance.PrivateIpAddress || '-'}`);
    console.log(`  Public IP:      ${instance.PublicIpAddress || '-'}`);
    console.log(`  Platform:       ${instance.PlatformDetails || '-'}`);
    console.log(`  Launch Time:    ${lib.formatDate(instance.LaunchTime)}`);

    // Tags
    lib.log.section('Tags');
    if (instance.Tags && instance.Tags.length > 0) {
      for (const tag of instance.Tags) {
        console.log(`  ${tag.Key}: ${tag.Value}`);
      }
    } else {
      lib.log.info('No tags');
    }

    // Safety check
    if (this.isSafeToModify(instance)) {
      console.log('');
      lib.log.info('This instance can be started/stopped via CLI');
    } else {
      console.log('');
      lib.log.warn('This instance is managed by Terraform/ASG - CLI modification not recommended');
    }

    return 0;
  }

  async cmdStart(instanceId?: string): Promise<number> {
    if (!instanceId) {
      lib.log.fail('Instance ID is required');
      console.log('');
      console.log('Usage: npx tsx ec2-manage.ts start <instance-id>');
      return 1;
    }

    if (!/^i-[a-f0-9]{8,17}$/.test(instanceId)) {
      lib.log.fail('Invalid instance ID format');
      return 1;
    }

    lib.log.header(`Start EC2 Instance: ${instanceId}`);

    const instance = this.getInstance(instanceId);

    if (!instance) {
      lib.log.fail(`Instance '${instanceId}' not found`);
      return 1;
    }

    const name = this.getTagValue(instance, 'Name');
    const state = instance.State?.Name || 'unknown';

    lib.log.info(`Name: ${name || '-'}`);
    lib.log.info(`Current State: ${state}`);
    console.log('');

    // Check if already running
    if (state === 'running') {
      lib.log.info('Instance is already running');
      return 0;
    }

    // Safety check
    if (!this.isSafeToModify(instance)) {
      lib.log.fail('This instance is managed by Terraform/ASG');
      lib.log.fail('CLI modification is not allowed for safety');
      return 1;
    }

    // Confirm
    if (!this.options.force) {
      lib.log.warn('This will start the instance');
      if (!(await lib.confirm('Are you sure?'))) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // Start instance
    lib.log.section('Starting Instance');

    try {
      this.awsExec(`ec2 start-instances --instance-ids ${instanceId}`);
      lib.log.pass('Start command sent');
      lib.log.info('Instance is starting... (use "show" to check status)');
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to start instance: ${toError(error).message}`);
      return 1;
    }
  }

  async cmdStop(instanceId?: string): Promise<number> {
    if (!instanceId) {
      lib.log.fail('Instance ID is required');
      console.log('');
      console.log('Usage: npx tsx ec2-manage.ts stop <instance-id>');
      return 1;
    }

    if (!/^i-[a-f0-9]{8,17}$/.test(instanceId)) {
      lib.log.fail('Invalid instance ID format');
      return 1;
    }

    lib.log.header(`Stop EC2 Instance: ${instanceId}`);

    const instance = this.getInstance(instanceId);

    if (!instance) {
      lib.log.fail(`Instance '${instanceId}' not found`);
      return 1;
    }

    const name = this.getTagValue(instance, 'Name');
    const state = instance.State?.Name || 'unknown';

    lib.log.info(`Name: ${name || '-'}`);
    lib.log.info(`Current State: ${state}`);
    console.log('');

    // Check if already stopped
    if (state === 'stopped') {
      lib.log.info('Instance is already stopped');
      return 0;
    }

    // Safety check
    if (!this.isSafeToModify(instance)) {
      lib.log.fail('This instance is managed by Terraform/ASG');
      lib.log.fail('CLI modification is not allowed for safety');
      return 1;
    }

    // Confirm
    if (!this.options.force) {
      lib.log.warn('This will stop the instance');
      if (!(await lib.confirm('Are you sure?'))) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // Stop instance
    lib.log.section('Stopping Instance');

    try {
      this.awsExec(`ec2 stop-instances --instance-ids ${instanceId}`);
      lib.log.pass('Stop command sent');
      lib.log.info('Instance is stopping... (use "show" to check status)');
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to stop instance: ${toError(error).message}`);
      return 1;
    }
  }
}

// Only run when executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  Ec2Manage.main();
}

// ============================================================
// Exported Functions for tf-deploy.ts and other scripts
// ============================================================

import type { EC2InstanceInfo, ASGInstance } from '../../infrastructure/types.js';

const { aws, awsGetRegion } = lib;

/**
 * Get EC2 instance details.
 */
export function ec2DescribeInstance(instanceId: string, region?: string): EC2InstanceInfo | null {
  const reg = region || awsGetRegion();
  const result = aws(
    `ec2 describe-instances --instance-ids ${instanceId} --query 'Reservations[0].Instances[0]' --output json`,
    { ignoreError: true, region: reg }
  );
  if (!result || result === 'null') return null;

  const data = safeParseJson(result, EC2InstanceQuerySchema, () => {});
  if (!data) return null;

  return {
    state: data.State?.Name,
    imageId: data.ImageId,
    instanceType: data.InstanceType,
    privateIp: data.PrivateIpAddress,
  };
}

/**
 * Get AMI info to check if it's minimal.
 */
export function ec2DescribeAMI(imageId: string, region?: string): { name: string; isMinimal: boolean } | null {
  if (!imageId) return null;
  const reg = region || awsGetRegion();
  const result = aws(
    `ec2 describe-images --image-ids ${imageId} --query 'Images[0]' --output json`,
    { ignoreError: true, region: reg }
  );
  if (!result || result === 'null') return null;

  const data = safeParseJson(result, EC2AMISchema, () => {});
  if (!data) return null;

  return {
    name: data.Name || '',
    isMinimal: data.Name?.includes('minimal') || false,
  };
}

/**
 * Get ASG instances by ASG name.
 */
export function asgGetInstances(asgName: string, region?: string): ASGInstance[] {
  if (!asgName) return [];
  const reg = region || awsGetRegion();
  const result = aws(
    `autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${asgName} --query 'AutoScalingGroups[0].Instances' --output json`,
    { ignoreError: true, region: reg }
  );
  if (!result || result === 'null') return [];

  const data = safeParseJson(result, ASGInstancesSchema, () => {});
  return (data || []).map((i) => ({
    instanceId: i.InstanceId,
    lifecycleState: i.LifecycleState,
    healthStatus: i.HealthStatus,
  }));
}
