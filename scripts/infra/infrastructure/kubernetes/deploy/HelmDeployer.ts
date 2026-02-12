/**
 * HelmDeployer - deploys Helm charts.
 *
 * Supports:
 *   - Helm install/upgrade
 *   - Repository management
 *   - OCI registry charts
 *   - Both direct helm and bastion-based execution
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import type {
  DeployerConfig,
  DeployerDependencies,
  DeployResult,
  HelmInstallOptions,
  HelmUpgradeOptions,
} from './deployers-types.js';

/** Default dependencies using production implementations */
const defaultDependencies: DeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/**
 * Deployer for Helm charts.
 *
 * @example
 * const helm = new HelmDeployer({ namespace: 'kube-system' });
 *
 * // Add repository and install
 * await helm.addRepo('eks', 'https://aws.github.io/eks-charts');
 * await helm.install({
 *   releaseName: 'aws-load-balancer-controller',
 *   chart: 'eks/aws-load-balancer-controller',
 *   set: { clusterName: 'my-cluster' },
 * });
 *
 * @example
 * // Install from OCI registry
 * await helm.install({
 *   releaseName: 'karpenter',
 *   chart: 'oci://public.ecr.aws/karpenter/karpenter',
 *   version: '1.1.0',
 *   createNamespace: true,
 * });
 *
 * @example
 * // Testing with mock dependencies
 * const deps = { run: vi.fn(), log: mockLogger };
 * const helm = new HelmDeployer(config, deps);
 */
export class HelmDeployer {
  private config: DeployerConfig;
  private deps: DeployerDependencies;

  constructor(config: DeployerConfig, deps: Partial<DeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Add a Helm repository.
   *
   * @param name - Repository name
   * @param url - Repository URL
   * @returns Result
   */
  async addRepo(name: string, url: string): Promise<DeployResult> {
    const cmd = `helm repo add ${name} ${url} 2>/dev/null || true`;
    return this.execute(cmd, `Add repo ${name}`);
  }

  /**
   * Update Helm repositories.
   *
   * @returns Result
   */
  async updateRepos(): Promise<DeployResult> {
    const cmd = 'helm repo update';
    return this.execute(cmd, 'Update repos');
  }

  /**
   * Install a Helm chart.
   *
   * @param options - Installation options
   * @returns Result
   */
  async install(options: HelmInstallOptions): Promise<DeployResult> {
    const cmd = this.buildInstallCommand('install', options);
    return this.execute(cmd, `Install ${options.releaseName}`);
  }

  /**
   * Upgrade a Helm release.
   *
   * @param options - Upgrade options
   * @returns Result
   */
  async upgrade(options: HelmUpgradeOptions): Promise<DeployResult> {
    const cmd = this.buildInstallCommand('upgrade', options);
    return this.execute(cmd, `Upgrade ${options.releaseName}`);
  }

  /**
   * Install or upgrade a Helm release.
   *
   * @param options - Installation/upgrade options
   * @returns Result
   */
  async installOrUpgrade(options: HelmInstallOptions): Promise<DeployResult> {
    const upgradeOptions: HelmUpgradeOptions = {
      ...options,
      install: true,
    };
    return this.upgrade(upgradeOptions);
  }

  /**
   * Uninstall a Helm release.
   *
   * @param releaseName - Release name
   * @returns Result
   */
  async uninstall(releaseName: string): Promise<DeployResult> {
    const ns = this.config.namespace;
    const cmd = `helm uninstall ${releaseName} -n ${ns} --wait`;
    return this.execute(cmd, `Uninstall ${releaseName}`);
  }

  /**
   * Check if a release exists.
   *
   * @param releaseName - Release name
   * @returns True if release exists
   */
  async releaseExists(releaseName: string): Promise<boolean> {
    const ns = this.config.namespace;
    const cmd = `helm list -n ${ns} -q | grep -q "^${releaseName}$"`;
    const result = await this.execute(cmd, `Check ${releaseName}`, true);
    return result.success;
  }

  /**
   * Get release status.
   *
   * @param releaseName - Release name
   * @returns Result with status in output
   */
  async status(releaseName: string): Promise<DeployResult> {
    const ns = this.config.namespace;
    const cmd = `helm status ${releaseName} -n ${ns}`;
    return this.execute(cmd, `Status ${releaseName}`);
  }

  /**
   * List releases in the namespace.
   *
   * @returns Result with release list in output
   */
  async list(): Promise<DeployResult> {
    const ns = this.config.namespace;
    const cmd = `helm list -n ${ns}`;
    return this.execute(cmd, 'List releases');
  }

  /**
   * Build the helm install/upgrade command.
   */
  private buildInstallCommand(
    action: 'install' | 'upgrade',
    options: HelmInstallOptions | HelmUpgradeOptions
  ): string {
    const ns = this.config.namespace;
    const parts: string[] = ['helm', action];

    // For upgrade with install flag
    if (action === 'upgrade' && (options as HelmUpgradeOptions).install) {
      parts.push('--install');
    }

    // Release name and chart
    parts.push(options.releaseName);
    parts.push(options.chart);

    // Namespace
    parts.push('-n', ns);

    // Version
    if (options.version) {
      parts.push('--version', options.version);
    }

    // Create namespace
    if (options.createNamespace) {
      parts.push('--create-namespace');
    }

    // Values file
    if (options.valuesFile) {
      parts.push('-f', options.valuesFile);
    }

    // Set values
    if (options.set) {
      for (const [key, value] of Object.entries(options.set)) {
        // Escape special characters in value
        const escapedValue = value.replace(/\//g, '\\/').replace(/,/g, '\\,');
        parts.push('--set', `${key}=${escapedValue}`);
      }
    }

    // Values object (converted to --set flags)
    if (options.values) {
      const flatValues = this.flattenValues(options.values);
      for (const [key, value] of Object.entries(flatValues)) {
        parts.push('--set', `${key}=${value}`);
      }
    }

    // Wait
    if (options.wait) {
      parts.push('--wait');
    }

    // Timeout
    if (options.timeout) {
      parts.push('--timeout', `${options.timeout}s`);
    }

    // Upgrade-specific options
    if (action === 'upgrade') {
      const upgradeOpts = options as HelmUpgradeOptions;
      if (upgradeOpts.resetValues) {
        parts.push('--reset-values');
      }
      if (upgradeOpts.reuseValues) {
        parts.push('--reuse-values');
      }
    }

    // Dry run
    if (this.config.dryRun) {
      parts.push('--dry-run');
    }

    return parts.join(' ');
  }

  /**
   * Flatten a nested values object to dot-notation keys.
   */
  private flattenValues(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenValues(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        // Handle arrays with {index} notation
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.assign(result, this.flattenValues(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            result[`${fullKey}[${index}]`] = String(item);
          }
        });
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  /**
   * Execute a helm command.
   */
  private async execute(cmd: string, label: string, silent = false): Promise<DeployResult> {
    const isSilent = silent || this.config.silent;

    try {
      if (this.config.bastionRunner) {
        // Execute via bastion
        const result = await this.config.bastionRunner.execute(cmd, {
          label,
          stream: !isSilent,
        });

        if (result.success) {
          if (!isSilent) this.deps.log.pass(label);
          return { success: true, output: result.output };
        } else {
          if (!isSilent) this.deps.log.fail(label);
          return { success: false, error: result.output };
        }
      } else {
        // Execute directly
        const output = this.deps.run(cmd, { ignoreError: true });

        if (output !== null) {
          if (!isSilent) this.deps.log.pass(label);
          return { success: true, output };
        } else {
          if (!isSilent) this.deps.log.fail(label);
          return { success: false, error: 'Command failed' };
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (!isSilent) this.deps.log.fail(`${label}: ${error}`);
      return { success: false, error };
    }
  }
}
