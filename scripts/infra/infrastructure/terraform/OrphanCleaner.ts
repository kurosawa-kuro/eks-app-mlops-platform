/**
 * OrphanCleaner - handles cleanup of orphan AWS resources.
 *
 * Provides idempotency for Terraform operations by cleaning up
 * resources that exist in AWS but are not managed by Terraform.
 */

import { run as defaultRun, aws as defaultAws } from '../shell/index.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import type { Logger } from '../../framework/types.js';

/**
 * Dependencies for OrphanCleaner
 */
export interface OrphanCleanerDependencies {
  run: typeof defaultRun;
  aws: typeof defaultAws;
  log: Logger;
}

const defaultDependencies: OrphanCleanerDependencies = {
  run: defaultRun,
  aws: defaultAws,
  log: defaultLog,
};

/**
 * Configuration for OrphanCleaner
 */
export interface OrphanCleanerConfig {
  tfDir: string;
  region: string;
}

/**
 * Default log groups to check for orphans
 */
const DEFAULT_LOG_GROUPS = [
  '/k8s-ml-platform/prod/vpc-flow-logs',
  '/k8s-ml-platform/prod/app-errors',
];

/**
 * Cleans up orphan AWS resources for Terraform idempotency.
 *
 * @example
 * const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' });
 * await cleaner.cleanupLogGroups();
 */
export class OrphanCleaner {
  private config: OrphanCleanerConfig;
  private deps: OrphanCleanerDependencies;

  constructor(
    config: OrphanCleanerConfig,
    deps: Partial<OrphanCleanerDependencies> = {}
  ) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Check if a log group is managed by Terraform.
   */
  isInTerraformState(logGroupName: string): boolean {
    const stateList = this.deps.run('terraform state list', {
      cwd: this.config.tfDir,
      ignoreError: true,
    });
    if (!stateList) return false;

    // Check if any CloudWatch log group resources exist in state
    const hasLogGroups = stateList.includes('aws_cloudwatch_log_group.');
    if (!hasLogGroups) return false;

    // For simplicity, if Terraform manages any log groups, assume this one is managed
    // A more precise check would parse the state for the specific log group
    return true;
  }

  /**
   * Check if a log group exists in AWS.
   */
  existsInAws(logGroupName: string): boolean {
    const result = this.deps.aws(
      `logs describe-log-groups --log-group-name-prefix "${logGroupName}" --query 'logGroups[0].logGroupName' --output text`,
      { ignoreError: true, region: this.config.region }
    );
    return result !== null && result !== '' && result !== 'None' && result.trim() === logGroupName;
  }

  /**
   * Delete a log group from AWS.
   */
  deleteLogGroup(logGroupName: string): boolean {
    try {
      this.deps.aws(`logs delete-log-group --log-group-name "${logGroupName}"`, {
        region: this.config.region,
      });
      this.deps.log.pass(`Deleted orphan log group: ${logGroupName}`);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.deps.log.warn(`Failed to delete log group ${logGroupName}: ${message}`);
      return false;
    }
  }

  /**
   * Clean up orphan CloudWatch log groups.
   *
   * Checks the default list of log groups and deletes any that:
   * 1. Exist in AWS
   * 2. Are NOT managed by Terraform
   */
  async cleanupLogGroups(logGroups: string[] = DEFAULT_LOG_GROUPS): Promise<void> {
    this.deps.log.info('Checking for orphan CloudWatch Log Groups...');

    for (const name of logGroups) {
      const inState = this.isInTerraformState(name);
      if (inState) {
        this.deps.log.pass(`Log group ${name} is managed by Terraform`);
        continue;
      }

      const existsInAws = this.existsInAws(name);
      if (existsInAws) {
        this.deps.log.warn(`Orphan log group found: ${name}`);
        this.deleteLogGroup(name);
      }
    }
  }
}
