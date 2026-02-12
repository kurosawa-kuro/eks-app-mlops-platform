/**
 * DI Container Factory for Infrastructure Scripts
 *
 * Creates and configures the Awilix DI container with all dependencies.
 * Following the pattern used in apps/app-backend.
 *
 * NOTE: This is a transitional implementation. Many dependencies are
 * registered as stubs and will be properly implemented during the
 * infrastructure layer migration.
 */

import { createContainer, asClass, asValue, asFunction, InjectionMode } from 'awilix';
import type {
  InfraCradle,
  InfraContainer,
  IShellExecutor,
  IKubectl,
  IHelm,
  ISSMCommandRunner,
  IS3Uploader,
  IManifestDeployer,
  IHelmDeployer,
  IClusterMonitor,
  INodeGroupMonitor,
  IASGMonitor,
  IBastionMonitor,
  IPreflightChecker,
  MonitorResult,
  DeployResult,
  SSMExecuteResult,
  OutcomeSummary,
  ContextInfo,
  PreflightResults,
} from './types.js';
import { createConfig } from '../config/index.js';
import { log } from '../framework/logging/index.js';
import type { RunResult, TerraformOutputs } from '../infrastructure/types.js';
import type { CheckResult, PollResult } from '../framework/types.js';

// ============================================================
// Stub Implementations
// ============================================================

// These stubs will be replaced with real implementations during
// the infrastructure layer migration.

const notImplemented = <T>(defaultValue: T) => async (): Promise<T> => defaultValue;

const stubRunResult: RunResult = { success: false, output: 'Not implemented via DI yet' };
const stubDeployResult: DeployResult = { success: false, error: 'Not implemented via DI yet' };
const stubSSMResult: SSMExecuteResult = { success: false, error: 'Not implemented via DI yet' };
const stubMonitorResult: PollResult<MonitorResult> = {
  success: false,
  reason: 'Not implemented via DI yet',
};

/**
 * Stub shell executor
 */
function createStubShellExecutor(): IShellExecutor {
  return {
    run: notImplemented(stubRunResult),
    aws: notImplemented(null),
    runStreaming: notImplemented({ stdout: '', stderr: '', code: 1 }),
  };
}

/**
 * Stub kubectl
 */
function createStubKubectl(): IKubectl {
  return {
    apply: notImplemented(stubRunResult),
    applyFile: notImplemented(stubRunResult),
    applyKustomize: notImplemented(stubRunResult),
    get: notImplemented(stubRunResult),
    delete: notImplemented(stubRunResult),
    rolloutStatus: notImplemented(stubRunResult),
    exec: notImplemented(stubRunResult),
    logs: notImplemented(stubRunResult),
    wait: notImplemented(stubRunResult),
    version: () => null,
    ensureNamespace: notImplemented(stubRunResult),
    getClusterStatus: () => null,
  };
}

/**
 * Stub helm
 */
function createStubHelm(): IHelm {
  return {
    install: notImplemented(stubRunResult),
    upgrade: notImplemented(stubRunResult),
    uninstall: notImplemented(stubRunResult),
    repoAdd: notImplemented(stubRunResult),
    repoUpdate: notImplemented(stubRunResult),
    status: notImplemented(stubRunResult),
    addRepo: notImplemented(stubRunResult),
    installOrUpgrade: notImplemented(stubRunResult),
  };
}

/**
 * Stub SSM runner
 */
function createStubSSMRunner(): ISSMCommandRunner {
  return {
    execute: notImplemented(stubSSMResult),
    kubectl: notImplemented(stubSSMResult),
    helm: notImplemented(stubSSMResult),
  };
}

/**
 * Stub S3 uploader
 */
function createStubS3Uploader(): IS3Uploader {
  return {
    upload: notImplemented({ success: false, error: 'Not implemented via DI yet' }),
    uploadFile: notImplemented({ success: false, error: 'Not implemented via DI yet' }),
  };
}

/**
 * Stub manifest deployer
 */
function createStubManifestDeployer(): IManifestDeployer {
  return {
    applyInline: notImplemented(stubDeployResult),
    applyFile: notImplemented(stubDeployResult),
    applyKustomize: notImplemented(stubDeployResult),
  };
}

/**
 * Stub helm deployer
 */
function createStubHelmDeployer(): IHelmDeployer {
  return {
    install: notImplemented(stubDeployResult),
    upgrade: notImplemented(stubDeployResult),
  };
}

/**
 * Stub cluster monitor
 */
function createStubClusterMonitor(): IClusterMonitor {
  return {
    waitForActive: notImplemented(stubMonitorResult),
    waitForCluster: notImplemented({ success: false, reason: 'Not implemented via DI yet' }),
  };
}

/**
 * Stub node group monitor
 */
function createStubNodeGroupMonitor(): INodeGroupMonitor {
  return {
    waitForActive: notImplemented(stubMonitorResult),
    waitForNodeGroups: notImplemented({ success: false, reason: 'Not implemented via DI yet' }),
  };
}

/**
 * Stub ASG monitor
 */
function createStubASGMonitor(): IASGMonitor {
  return {
    waitForHealthy: notImplemented(stubMonitorResult),
  };
}

/**
 * Stub bastion monitor
 */
function createStubBastionMonitor(): IBastionMonitor {
  return {
    waitForOnline: notImplemented(stubMonitorResult),
  };
}

/**
 * Stub preflight checker
 */
function createStubPreflightChecker(): IPreflightChecker {
  const okResult: CheckResult = { ok: true, detail: 'Stub check' };
  return {
    checkAwsCli: async () => okResult,
    checkAwsCredentials: async () => okResult,
    checkKubectl: async () => okResult,
    checkHelm: async () => okResult,
    checkDocker: async () => okResult,
    checkTerraform: async () => okResult,
    runAll: async () => ({ checks: [], allPassed: true }),
    run: async () => ({ passed: true, errors: [] }),
  };
}

// ============================================================
// Presenter Implementations
// ============================================================

/**
 * Phase presenter - displays phase progress (起承転結)
 */
class PhasePresenterAdapter {
  start(name: string, index?: number): void {
    if (index !== undefined) {
      log.phase(index, name);
    } else {
      log.section(name);
    }
  }

  success(name: string, duration?: number): void {
    const msg = duration ? `${name} (${duration}ms)` : name;
    log.pass(msg);
  }

  failure(name: string, error?: string): void {
    const msg = error ? `${name}: ${error}` : name;
    log.fail(msg);
  }

  skip(name: string, reason?: string): void {
    const msg = reason ? `${name}: ${reason}` : name;
    log.skip(msg);
  }
}

/**
 * Outcome presenter - displays final result
 */
class OutcomePresenterAdapter {
  showSuccess(summary: OutcomeSummary): void {
    log.pass(`${summary.operation} completed successfully`);
    if (summary.duration) {
      log.info(`Duration: ${summary.duration}ms`);
    }
    if (summary.details) {
      for (const [key, value] of Object.entries(summary.details)) {
        log.info(`  ${key}: ${value}`);
      }
    }
    if (summary.nextSteps && summary.nextSteps.length > 0) {
      log.section('Next Steps');
      for (const step of summary.nextSteps) {
        log.info(`  - ${step}`);
      }
    }
  }

  showFailure(summary: OutcomeSummary, error?: Error): void {
    log.fail(`${summary.operation} failed`);
    if (error) {
      log.fail(`Error: ${error.message}`);
    }
  }
}

/**
 * Context presenter - displays initial state
 */
class ContextPresenterAdapter {
  show(context: ContextInfo): void {
    log.header(context.operation);
    if (context.environment) log.info(`Environment: ${context.environment}`);
    if (context.region) log.info(`Region: ${context.region}`);
    if (context.cluster) log.info(`Cluster: ${context.cluster}`);
    if (context.overlay) log.info(`Overlay: ${context.overlay}`);
    if (context.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        log.info(`${key}: ${value}`);
      }
    }
  }
}

/**
 * Preflight presenter - displays preflight check results
 */
class PreflightPresenterAdapter {
  showResults(results: PreflightResults): void {
    log.section('Preflight Checks');
    for (const check of results.checks) {
      if (check.result.ok) {
        const detail = check.result.detail ? ` (${check.result.detail})` : '';
        log.pass(`${check.name}${detail}`);
      } else {
        const error = check.result.error ? `: ${check.result.error}` : '';
        log.fail(`${check.name}${error}`);
      }
    }
    if (results.allPassed) {
      log.pass('All preflight checks passed');
    } else {
      log.fail('Some preflight checks failed');
    }
  }
}

// ============================================================
// Stub Terraform Outputs
// ============================================================

function createStubTerraformOutputs(): TerraformOutputs {
  return {
    get: () => null,
    s3Bucket: () => undefined,
    apiUrl: () => undefined,
    bastionId: () => null,
    lbRoleArn: () => null,
    vpcId: () => null,
    clusterName: () => null,
    clusterEndpoint: () => null,
    karpenterRoleArn: () => null,
    karpenterQueueName: () => null,
    workloadRoleArn: () => null,
    ecrMlopsUrl: () => null,
  };
}

// ============================================================
// Container Factory
// ============================================================

/**
 * Creates and configures the Awilix DI container
 *
 * @param tfDir - Optional Terraform directory path (defaults to prod)
 * @returns Configured InfraContainer
 */
export function createInfraContainer(tfDir?: string): InfraContainer {
  const container = createContainer<InfraCradle>({
    injectionMode: InjectionMode.CLASSIC,
  });

  // Create config (will throw if tfDir doesn't exist, using stub for now)
  let config;
  try {
    config = createConfig(tfDir);
  } catch {
    // If config creation fails (e.g., terraform not run), use minimal config
    config = {
      region: process.env.AWS_REGION || 'ap-northeast-1',
      accountId: null,
      clusterName: null,
      clusterEndpoint: null,
      bastionInstanceId: null,
      s3Bucket: null,
      workloadRoleArn: null,
      lbControllerRoleArn: null,
      karpenterRoleArn: null,
      karpenterQueueName: null,
      vpcId: null,
      ecrMlopsUrl: null,
      apiUrl: null,
      tfDir: tfDir || '',
      tf: createStubTerraformOutputs(),
      require: () => { throw new Error('Config not loaded'); },
      validate: () => { throw new Error('Config not loaded'); },
      validateStrict: () => ({ success: false, errors: ['Config not loaded'] }),
    };
  }

  container.register({
    // Configuration
    config: asValue(config),
    logger: asValue(log),

    // Infrastructure - Shell
    shellExecutor: asFunction(createStubShellExecutor).singleton(),

    // Infrastructure - AWS
    ssmRunner: asFunction(createStubSSMRunner).singleton(),
    s3Uploader: asFunction(createStubS3Uploader).singleton(),
    terraformOutputs: asValue(config.tf),

    // Infrastructure - Kubernetes
    kubectl: asFunction(createStubKubectl).singleton(),
    helm: asFunction(createStubHelm).singleton(),
    manifestDeployer: asFunction(createStubManifestDeployer).singleton(),
    helmDeployer: asFunction(createStubHelmDeployer).singleton(),

    // Monitors
    clusterMonitor: asFunction(createStubClusterMonitor).singleton(),
    nodeGroupMonitor: asFunction(createStubNodeGroupMonitor).singleton(),
    asgMonitor: asFunction(createStubASGMonitor).singleton(),
    bastionMonitor: asFunction(createStubBastionMonitor).singleton(),

    // Presenters
    phasePresenter: asClass(PhasePresenterAdapter).singleton(),
    outcomePresenter: asClass(OutcomePresenterAdapter).singleton(),
    contextPresenter: asClass(ContextPresenterAdapter).singleton(),
    preflightPresenter: asClass(PreflightPresenterAdapter).singleton(),

    // Lifecycle
    preflightChecker: asFunction(createStubPreflightChecker).singleton(),
  });

  return container;
}

/**
 * Helper function to resolve a dependency from the container
 */
export function resolve<K extends keyof InfraCradle>(
  container: InfraContainer,
  name: K
): InfraCradle[K] {
  return container.resolve(name);
}

// Re-export types
export type { InfraCradle, InfraContainer } from './types.js';
