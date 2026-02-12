/**
 * DI Container Types for Infrastructure Scripts
 *
 * Defines the Cradle interface (all registered dependencies) and container type.
 * Following the awilix pattern used in apps/app-backend.
 */

import type { AwilixContainer } from 'awilix';
import type { Config } from '../config/index.js';
import type { Logger, CheckResult, PollerOptions, PollResult, PollerResult } from '../framework/types.js';
import type { RunOptions, RunResult, TerraformOutputs } from '../infrastructure/types.js';

// ============================================================
// Infrastructure Layer Interfaces
// ============================================================

/**
 * Shell command execution interface
 */
export interface IShellExecutor {
  run(cmd: string, options?: RunOptions): Promise<RunResult>;
  aws<T>(cmd: string, options?: RunOptions): Promise<T | null>;
  runStreaming(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }>;
}

/**
 * Kubectl command interface
 */
export interface IKubectl {
  apply(manifest: string, namespace?: string): Promise<RunResult>;
  applyFile(path: string): Promise<RunResult>;
  applyKustomize(path: string): Promise<RunResult>;
  get(resource: string, name?: string, namespace?: string): Promise<RunResult>;
  delete(resource: string, name: string, namespace?: string): Promise<RunResult>;
  rolloutStatus(resource: string, name: string, namespace?: string, timeout?: number): Promise<RunResult>;
  exec(namespace: string, pod: string, command: string[]): Promise<RunResult>;
  logs(namespace: string, pod: string, options?: { tail?: number; follow?: boolean }): Promise<RunResult>;
  wait(resource: string, condition: string, timeout?: number, namespace?: string): Promise<RunResult>;
  version(): string | null;
  ensureNamespace(namespace: string): Promise<RunResult>;
  getClusterStatus(name: string, namespace: string): string | null;
}

/**
 * Helm command interface
 */
export interface IHelm {
  install(release: string, chart: string, options?: HelmOptions): Promise<RunResult>;
  upgrade(release: string, chart: string, options?: HelmOptions): Promise<RunResult>;
  uninstall(release: string, namespace?: string): Promise<RunResult>;
  repoAdd(name: string, url: string): Promise<RunResult>;
  repoUpdate(): Promise<RunResult>;
  status(release: string, namespace?: string): Promise<RunResult>;
  addRepo(name: string, url: string): Promise<RunResult>;
  installOrUpgrade(options: HelmInstallOptions): Promise<RunResult>;
}

export interface HelmInstallOptions {
  releaseName: string;
  chart: string;
  namespace?: string;
  createNamespace?: boolean;
  values?: Record<string, unknown>;
  valuesFile?: string;
  set?: Record<string, string>;
  wait?: boolean;
  timeout?: number;
  version?: string;
}

export interface HelmOptions {
  namespace?: string;
  createNamespace?: boolean;
  values?: Record<string, unknown>;
  valuesFile?: string;
  set?: Record<string, string>;
  wait?: boolean;
  timeout?: string;
  version?: string;
}

/**
 * SSM Command Runner interface (execute commands on EC2 via SSM)
 */
export interface ISSMCommandRunner {
  execute(command: string, options?: SSMExecuteOptions): Promise<SSMExecuteResult>;
  kubectl(args: string, options?: SSMExecuteOptions): Promise<SSMExecuteResult>;
  helm(args: string, options?: SSMExecuteOptions): Promise<SSMExecuteResult>;
}

export interface SSMExecuteOptions {
  timeout?: number;
  label?: string;
  stream?: boolean;
}

export interface SSMExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  status?: string;
}

/**
 * S3 Uploader interface
 */
export interface IS3Uploader {
  upload(bucket: string, key: string, body: string | Buffer): Promise<{ success: boolean; error?: string }>;
  uploadFile(bucket: string, key: string, filePath: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * Terraform outputs reader interface
 */
export interface ITerraformOutputs extends TerraformOutputs {}

// ============================================================
// Monitor Interfaces
// ============================================================

/**
 * Base monitor result
 */
export interface MonitorResult extends PollerResult {
  status?: string;
  message?: string;
}

/**
 * Cluster monitor interface
 */
export interface IClusterMonitor {
  waitForActive(clusterName: string, options?: PollerOptions<MonitorResult>): Promise<PollResult<MonitorResult>>;
  waitForCluster(): Promise<ClusterMonitorResult>;
}

export interface ClusterMonitorResult {
  success: boolean;
  reason?: string;
  status?: string;
}

/**
 * Node group monitor interface
 */
export interface INodeGroupMonitor {
  waitForActive(clusterName: string, nodeGroupName: string, options?: PollerOptions<MonitorResult>): Promise<PollResult<MonitorResult>>;
  waitForNodeGroups(): Promise<NodeGroupMonitorResult>;
}

export interface NodeGroupMonitorResult {
  success: boolean;
  reason?: string;
}

/**
 * ASG monitor interface
 */
export interface IASGMonitor {
  waitForHealthy(asgName: string, desiredCount: number, options?: PollerOptions<MonitorResult>): Promise<PollResult<MonitorResult>>;
}

/**
 * Bastion monitor interface
 */
export interface IBastionMonitor {
  waitForOnline(instanceId: string, options?: PollerOptions<MonitorResult>): Promise<PollResult<MonitorResult>>;
}

// ============================================================
// Deployer Interfaces
// ============================================================

/**
 * Manifest deployer interface
 */
export interface IManifestDeployer {
  applyInline(yaml: string, options?: DeployOptions): Promise<DeployResult>;
  applyFile(path: string, options?: DeployOptions): Promise<DeployResult>;
  applyKustomize(path: string, options?: DeployOptions): Promise<DeployResult>;
}

/**
 * Helm deployer interface
 */
export interface IHelmDeployer {
  install(release: string, chart: string, options?: HelmDeployOptions): Promise<DeployResult>;
  upgrade(release: string, chart: string, options?: HelmDeployOptions): Promise<DeployResult>;
}

export interface DeployOptions {
  namespace?: string;
  dryRun?: boolean;
  waitForRollout?: boolean;
  rolloutResource?: string;
  rolloutTimeout?: number;
}

export interface HelmDeployOptions extends DeployOptions {
  values?: Record<string, unknown>;
  valuesFile?: string;
  set?: Record<string, string>;
  version?: string;
  createNamespace?: boolean;
}

export interface DeployResult {
  success: boolean;
  output?: string;
  error?: string;
}

// ============================================================
// Presenter Interfaces
// ============================================================

/**
 * Phase presenter interface (起承転結 display)
 */
export interface IPhasePresenter {
  start(name: string, index?: number): void;
  success(name: string, duration?: number): void;
  failure(name: string, error?: string): void;
  skip(name: string, reason?: string): void;
}

/**
 * Outcome presenter interface (final result display)
 */
export interface IOutcomePresenter {
  showSuccess(summary: OutcomeSummary): void;
  showFailure(summary: OutcomeSummary, error?: Error): void;
}

export interface OutcomeSummary {
  operation: string;
  duration?: number;
  details?: Record<string, string | number | boolean | null>;
  nextSteps?: string[];
}

/**
 * Context presenter interface (initial state display)
 */
export interface IContextPresenter {
  show(context: ContextInfo): void;
}

export interface ContextInfo {
  operation: string;
  environment?: string;
  region?: string;
  cluster?: string;
  overlay?: string;
  extras?: Record<string, string | number | boolean | null>;
}

/**
 * Preflight presenter interface
 */
export interface IPreflightPresenter {
  showResults(results: PreflightResults): void;
}

export interface PreflightResults {
  checks: Array<{ name: string; result: CheckResult }>;
  allPassed: boolean;
}

// ============================================================
// Lifecycle Interfaces
// ============================================================

/**
 * Preflight checker interface
 */
export interface IPreflightChecker {
  checkAwsCli(): Promise<CheckResult>;
  checkAwsCredentials(): Promise<CheckResult>;
  checkKubectl(): Promise<CheckResult>;
  checkHelm(): Promise<CheckResult>;
  checkDocker(): Promise<CheckResult>;
  checkTerraform(): Promise<CheckResult>;
  runAll(checks: string[]): Promise<PreflightResults>;
  run(): Promise<PreflightCheckResult>;
}

export interface PreflightCheckResult {
  passed: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Poller interface (generic polling utility)
 */
export interface IPoller<T extends PollerResult = PollerResult> {
  poll(
    checkFn: () => Promise<T>,
    options?: PollerOptions<T>
  ): Promise<PollResult<T>>;
}

// ============================================================
// Cradle Interface (DI Container)
// ============================================================

/**
 * DI Container cradle - all registered dependencies
 */
export interface InfraCradle {
  // Configuration
  config: Config;
  logger: Logger;

  // Infrastructure - Shell
  shellExecutor: IShellExecutor;

  // Infrastructure - AWS
  ssmRunner: ISSMCommandRunner;
  s3Uploader: IS3Uploader;
  terraformOutputs: ITerraformOutputs;

  // Infrastructure - Kubernetes
  kubectl: IKubectl;
  helm: IHelm;
  manifestDeployer: IManifestDeployer;
  helmDeployer: IHelmDeployer;

  // Monitors
  clusterMonitor: IClusterMonitor;
  nodeGroupMonitor: INodeGroupMonitor;
  asgMonitor: IASGMonitor;
  bastionMonitor: IBastionMonitor;

  // Presenters
  phasePresenter: IPhasePresenter;
  outcomePresenter: IOutcomePresenter;
  contextPresenter: IContextPresenter;
  preflightPresenter: IPreflightPresenter;

  // Lifecycle
  preflightChecker: IPreflightChecker;
}

/**
 * Application container type
 */
export type InfraContainer = AwilixContainer<InfraCradle>;
