/**
 * ManifestDeployer - deploys Kubernetes manifests.
 *
 * Supports:
 *   - Inline manifest deployment (kubectl apply -f -)
 *   - File-based deployment (kubectl apply -f <file>)
 *   - Kustomize deployment (kubectl apply -k <dir>)
 *   - Rollout management
 *   - Both direct kubectl and bastion-based execution
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import type {
  DeployerConfig,
  DeployerDependencies,
  DeployResult,
  ManifestDeployOptions,
  KustomizeDeployOptions,
  RolloutOptions,
} from './deployers-types.js';

/** Default dependencies using production implementations */
const defaultDependencies: DeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/**
 * Deployer for Kubernetes manifests.
 *
 * @example
 * // Direct kubectl access
 * const deployer = new ManifestDeployer({ namespace: 'app' });
 * await deployer.applyManifest(yaml);
 *
 * @example
 * // Via bastion host
 * const deployer = new ManifestDeployer({
 *   namespace: 'app',
 *   bastionRunner: ssmRunner,
 * });
 * await deployer.applyKustomize('/path/to/overlay');
 *
 * @example
 * // Testing with mock dependencies
 * const deps = { run: vi.fn(), log: mockLogger };
 * const deployer = new ManifestDeployer(config, deps);
 */
export class ManifestDeployer {
  private config: DeployerConfig;
  private deps: DeployerDependencies;

  constructor(config: DeployerConfig, deps: Partial<DeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Apply an inline manifest string.
   *
   * @param manifest - YAML manifest content
   * @param options - Deployment options
   * @returns Deployment result
   */
  async applyManifest(manifest: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';
    const cmd = `kubectl apply -f - -n ${ns}${dryRunFlag}`;

    return this.executeWithManifest(cmd, manifest, options);
  }

  /**
   * Apply a manifest from a file path.
   *
   * @param filePath - Path to the manifest file
   * @param options - Deployment options
   * @returns Deployment result
   */
  async applyFile(filePath: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';
    const cmd = `kubectl apply -f ${filePath} -n ${ns}${dryRunFlag}`;

    return this.execute(cmd, options);
  }

  /**
   * Apply manifests from a Kustomize directory.
   *
   * @param kustomizeDir - Path to the Kustomize directory
   * @param options - Deployment options
   * @returns Deployment result
   */
  async applyKustomize(kustomizeDir: string, options: KustomizeDeployOptions = {}): Promise<DeployResult> {
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';

    if (options.buildOnly) {
      const cmd = `kubectl kustomize ${kustomizeDir}`;
      return this.execute(cmd, options);
    }

    const cmd = `kubectl apply -k ${kustomizeDir}${dryRunFlag}`;
    return this.execute(cmd, options);
  }

  /**
   * Delete resources from a manifest string.
   *
   * @param manifest - YAML manifest content
   * @param options - Options
   * @returns Result
   */
  async deleteManifest(manifest: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';
    const cmd = `kubectl delete -f - -n ${ns}${dryRunFlag} --ignore-not-found`;

    return this.executeWithManifest(cmd, manifest, options);
  }

  /**
   * Restart a deployment/statefulset.
   *
   * @param resourceType - 'deployment' or 'statefulset'
   * @param name - Resource name
   * @param options - Options
   * @returns Result
   */
  async rolloutRestart(resourceType: string, name: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const cmd = `kubectl rollout restart ${resourceType}/${name} -n ${ns}`;

    return this.execute(cmd, options);
  }

  /**
   * Wait for a rollout to complete.
   *
   * @param options - Rollout options
   * @returns Result
   */
  async rolloutStatus(options: RolloutOptions & { namespace?: string }): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const timeout = options.timeout ?? 120;
    const cmd = `kubectl rollout status ${options.resourceType}/${options.name} -n ${ns} --timeout=${timeout}s`;

    return this.execute(cmd, { label: `Rollout ${options.name}` });
  }

  /**
   * Create a namespace if it doesn't exist.
   *
   * @param namespace - Namespace name
   * @returns Result
   */
  async ensureNamespace(namespace: string): Promise<DeployResult> {
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';
    const cmd = `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -${dryRunFlag}`;

    return this.execute(cmd, { label: `Namespace ${namespace}` });
  }

  /**
   * Create a secret from literal values.
   *
   * @param name - Secret name
   * @param data - Key-value pairs
   * @param options - Options
   * @returns Result
   */
  async createSecretFromLiterals(
    name: string,
    data: Record<string, string>,
    options: ManifestDeployOptions = {}
  ): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const literals = Object.entries(data)
      .map(([k, v]) => `--from-literal=${k}='${v}'`)
      .join(' ');
    const dryRunFlag = this.config.dryRun ? ' --dry-run=client' : '';

    const cmd = `kubectl create secret generic ${name} -n ${ns} ${literals} --dry-run=client -o yaml | kubectl apply -f -${dryRunFlag}`;

    return this.execute(cmd, { ...options, label: options.label ?? `Secret ${name}` });
  }

  /**
   * Get pods in the namespace.
   *
   * @param selector - Label selector (optional)
   * @param options - Options
   * @returns Result with pod information in output
   */
  async getPods(selector?: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const selectorFlag = selector ? ` -l ${selector}` : '';
    const cmd = `kubectl get pods -n ${ns}${selectorFlag} -o wide`;

    return this.execute(cmd, options);
  }

  /**
   * Wait for pods to be ready.
   *
   * @param selector - Label selector
   * @param options - Options including timeout
   * @returns Result
   */
  async waitForPods(selector: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const ns = options.namespace ?? this.config.namespace;
    const timeout = options.waitTimeout ?? 120;
    const cmd = `kubectl wait --for=condition=Ready pod -l ${selector} -n ${ns} --timeout=${timeout}s`;

    return this.execute(cmd, options);
  }

  /**
   * Execute a kubectl command.
   */
  private async execute(cmd: string, options: ManifestDeployOptions = {}): Promise<DeployResult> {
    const label = options.label ?? 'kubectl';

    try {
      if (this.config.bastionRunner) {
        // Execute via bastion
        const result = await this.config.bastionRunner.execute(cmd, {
          label,
          stream: !this.config.silent,
        });

        if (result.success) {
          if (!this.config.silent) this.deps.log.pass(label);
          return { success: true, output: result.output };
        } else {
          if (!this.config.silent) this.deps.log.fail(label);
          return { success: false, error: result.output };
        }
      } else {
        // Execute directly
        const output = this.deps.run(cmd, { ignoreError: true });

        if (output !== null) {
          if (!this.config.silent) this.deps.log.pass(label);
          return { success: true, output };
        } else {
          if (!this.config.silent) this.deps.log.fail(label);
          return { success: false, error: 'Command failed' };
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (!this.config.silent) this.deps.log.fail(`${label}: ${error}`);
      return { success: false, error };
    }
  }

  /**
   * Execute a kubectl command with manifest input via stdin.
   */
  private async executeWithManifest(
    cmd: string,
    manifest: string,
    options: ManifestDeployOptions = {}
  ): Promise<DeployResult> {
    const label = options.label ?? 'kubectl apply';

    try {
      if (this.config.bastionRunner) {
        // Execute via bastion using heredoc
        const fullCmd = `cat << 'EOF' | ${cmd}\n${manifest}\nEOF`;
        const result = await this.config.bastionRunner.execute(fullCmd, {
          label,
          stream: !this.config.silent,
        });

        if (result.success) {
          if (!this.config.silent) this.deps.log.pass(label);
          return { success: true, output: result.output };
        } else {
          if (!this.config.silent) this.deps.log.fail(label);
          return { success: false, error: result.output };
        }
      } else {
        // Execute directly - need to handle stdin
        // For now, use a temporary approach with echo
        const escapedManifest = manifest.replace(/'/g, "'\\''");
        const fullCmd = `echo '${escapedManifest}' | ${cmd}`;
        const output = this.deps.run(fullCmd, { ignoreError: true });

        if (output !== null) {
          if (!this.config.silent) this.deps.log.pass(label);
          return { success: true, output };
        } else {
          if (!this.config.silent) this.deps.log.fail(label);
          return { success: false, error: 'Command failed' };
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (!this.config.silent) this.deps.log.fail(`${label}: ${error}`);
      return { success: false, error };
    }
  }
}
