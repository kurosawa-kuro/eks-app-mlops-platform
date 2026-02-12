#!/usr/bin/env npx tsx
/**
 * Smoke Test CLI
 *
 * Run infrastructure smoke tests to verify system health.
 *
 * Usage:
 *   npx tsx smoke/index.ts run            # Run all tests (normal mode)
 *   npx tsx smoke/index.ts run --strict   # Exit 1 on any failure (CI mode)
 *   npx tsx smoke/index.ts aws            # Run AWS test only
 *   npx tsx smoke/index.ts run --json     # Output as JSON
 *   npx tsx smoke/index.ts run --skip-app # Skip app health check
 *
 * Modes:
 *   Normal (default): Shows status, exits with specific error codes
 *   Strict (--strict): Exit 1 if ANY test fails (useful for CI/CD)
 */

import { InfraCommand, lib } from '../framework/command/InfraCommand.js';
import { showContext } from '../framework/narrative/index.js';
import type { SmokeResult, SmokeReport, SmokeOptions, SmokeTestName } from './types.js';
import { EXIT_CODES } from './types.js';
import { awsSmoke } from './aws.smoke.js';
import { eksSmoke } from './eks.smoke.js';
import { k8sSmoke } from './k8s.smoke.js';
import { appSmoke } from './app.smoke.js';
import { authSmoke } from './auth.smoke.js';
import { loginSmoke } from './login.smoke.js';
import { dbSmoke } from './db.smoke.js';
import {
  monitoringSmoke,
  prometheusSmoke,
  grafanaSmoke,
  lokiSmoke,
  alertmanagerSmoke,
} from './monitoring.smoke.js';

const { log, c } = lib;

// ============================================================
// Smoke Test Runner
// ============================================================

type SmokeTestFn = () => Promise<SmokeResult>;

const SMOKE_TESTS: Record<SmokeTestName, SmokeTestFn> = {
  // Infrastructure tests
  aws: awsSmoke,
  eks: eksSmoke,
  k8s: k8sSmoke,
  app: appSmoke,
  auth: authSmoke,
  // Monitoring tests
  monitoring: monitoringSmoke,
  prometheus: prometheusSmoke,
  grafana: grafanaSmoke,
  loki: lokiSmoke,
  alertmanager: alertmanagerSmoke,
  // E2E tests
  login: loginSmoke,
  db: dbSmoke,
};

interface ReportOptions {
  strict?: boolean;
  warnAsError?: boolean;
}

function createReport(results: SmokeResult[], options: ReportOptions = {}): SmokeReport {
  const { strict = false, warnAsError = false } = options;

  const passed = results.filter((r) => r.status === 'ok').length;
  const warnings = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  // Calculate exit code based on mode
  let exitCode: number;
  if (strict) {
    // Strict mode: exit 1 if any failure (or warning if warnAsError)
    const hasError = failed > 0 || (warnAsError && warnings > 0);
    exitCode = hasError ? 1 : 0;
  } else {
    // Normal mode: use specific exit codes
    const firstFailure = results.find((r) => r.status === 'fail');
    exitCode = firstFailure ? EXIT_CODES[firstFailure.name as SmokeTestName] || 1 : 0;
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      warnings,
      failed,
    },
    exitCode,
  };
}

function printResult(result: SmokeResult): void {
  const duration = `${result.durationMs}ms`;
  const name = result.name.toUpperCase().padEnd(4);

  switch (result.status) {
    case 'ok':
      log.pass(`[${name}] ${result.message} ${c.dim(`(${duration})`)}`);
      break;
    case 'warn':
      log.warn(`[${name}] ${result.message} ${c.dim(`(${duration})`)}`);
      break;
    case 'fail':
      log.fail(`[${name}] ${result.message} ${c.dim(`(${duration})`)}`);
      if (result.detail) {
        console.log(c.dim(`        Detail: ${JSON.stringify(result.detail)}`));
      }
      break;
  }
}

function printSummary(report: SmokeReport): void {
  console.log('');
  log.section('Summary');
  console.log(`  Total:    ${report.summary.total}`);
  console.log(`  ${c.green('Passed:')}  ${report.summary.passed}`);
  if (report.summary.warnings > 0) {
    console.log(`  ${c.yellow('Warnings:')} ${report.summary.warnings}`);
  }
  if (report.summary.failed > 0) {
    console.log(`  ${c.red('Failed:')}  ${report.summary.failed}`);
  }
  console.log('');

  // Show access URLs
  log.section('Access URLs');
  console.log(`  Frontend: ${c.cyan('https://app.tk-k8s.com')}`);
  console.log(`  API:      ${c.cyan('https://api.tk-k8s.com')}`);
  console.log('');
}

/**
 * Run all smoke tests (exported for tf-deploy.ts integration)
 */
export async function runAllSmokes(options: SmokeOptions = {}): Promise<SmokeReport> {
  const results: SmokeResult[] = [];

  // Build test order based on options
  const infraTests: SmokeTestName[] = options.skipApp
    ? ['aws', 'eks', 'k8s']
    : ['aws', 'eks', 'k8s', 'app', 'auth'];

  const e2eTests: SmokeTestName[] = options.skipE2E ? [] : ['login', 'db'];

  const testOrder: SmokeTestName[] = [...infraTests, ...e2eTests];

  for (const name of testOrder) {
    const testFn = SMOKE_TESTS[name];
    const result = await testFn();
    results.push(result);

    // Print result in non-JSON mode
    if (!options.json) {
      printResult(result);
    }
  }

  return createReport(results, {
    strict: options.strict,
    warnAsError: options.warnAsError,
  });
}

// ============================================================
// CLI Command
// ============================================================

class SmokeCommand extends InfraCommand {
  static name = 'smoke';
  static description = 'Infrastructure smoke tests';
  static commands = {
    run: { desc: 'Run all smoke tests', aliases: [''] },
    infra: { desc: 'Run infrastructure tests only (aws, eks, k8s, app, auth)' },
    e2e: { desc: 'Run E2E tests only (login, db)' },
    aws: { desc: 'Run AWS smoke test only' },
    eks: { desc: 'Run EKS smoke test only' },
    k8s: { desc: 'Run K8s smoke test only' },
    app: { desc: 'Run app smoke test only' },
    auth: { desc: 'Run auth smoke test only' },
    monitoring: { desc: 'Run all monitoring smoke tests', requireAws: true },
    prometheus: { desc: 'Run Prometheus smoke test only', requireAws: true },
    grafana: { desc: 'Run Grafana smoke test only', requireAws: true },
    loki: { desc: 'Run Loki smoke test only', requireAws: true },
    alertmanager: { desc: 'Run Alertmanager smoke test only', requireAws: true },
    login: { desc: 'Run login E2E test only' },
    db: { desc: 'Run database E2E test only' },
  };
  static options = {
    '--json': { name: 'json', type: 'boolean' as const, desc: 'Output results as JSON' },
    '--skip-app': { name: 'skipApp', type: 'boolean' as const, desc: 'Skip app health check' },
    '--skip-e2e': { name: 'skipE2E', type: 'boolean' as const, desc: 'Skip E2E tests (login, db)' },
    '--strict': { name: 'strict', type: 'boolean' as const, desc: 'Exit 1 on any failure (CI mode)' },
    '--warn-as-error': { name: 'warnAsError', type: 'boolean' as const, desc: 'Treat warnings as errors (requires --strict)' },
  };

  private isJson(): boolean {
    return this.options.json === true;
  }

  private isSkipApp(): boolean {
    return this.options.skipApp === true;
  }

  private isSkipE2E(): boolean {
    return this.options.skipE2E === true;
  }

  private isStrict(): boolean {
    return this.options.strict === true;
  }

  private isWarnAsError(): boolean {
    return this.options.warnAsError === true;
  }

  // Run all tests
  async cmdRun(): Promise<number> {
    const strict = this.isStrict();
    const warnAsError = this.isWarnAsError();
    const skipApp = this.isSkipApp();
    const skipE2E = this.isSkipE2E();

    if (!this.isJson()) {
      // 起 (Context)
      const mode = strict ? (warnAsError ? 'Strict (warn-as-error)' : 'Strict') : 'Normal';
      showContext('smoke-test', {
        mode,
        skipApp: skipApp ? 'Yes' : 'No',
        skipE2E: skipE2E ? 'Yes' : 'No',
      });
    }

    const report = await runAllSmokes({
      json: this.isJson(),
      skipApp,
      skipE2E,
      strict,
      warnAsError,
    });

    if (this.isJson()) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSummary(report);
      if (strict && report.exitCode !== 0) {
        console.log(c.red('  Strict mode: exiting with code 1'));
        console.log('');
      }
    }

    return report.exitCode;
  }

  // Run infrastructure tests only
  async cmdInfra(): Promise<number> {
    return this.runTestGroup(['aws', 'eks', 'k8s', 'app', 'auth']);
  }

  // Run E2E tests only
  async cmdE2e(): Promise<number> {
    return this.runTestGroup(['login', 'db']);
  }

  // Individual test commands
  async cmdAws(): Promise<number> {
    return this.runSingleTest('aws');
  }

  async cmdEks(): Promise<number> {
    return this.runSingleTest('eks');
  }

  async cmdK8s(): Promise<number> {
    return this.runSingleTest('k8s');
  }

  async cmdApp(): Promise<number> {
    return this.runSingleTest('app');
  }

  async cmdAuth(): Promise<number> {
    return this.runSingleTest('auth');
  }

  async cmdLogin(): Promise<number> {
    return this.runSingleTest('login');
  }

  async cmdDb(): Promise<number> {
    return this.runSingleTest('db');
  }

  // Monitoring test commands
  async cmdMonitoring(): Promise<number> {
    return this.runTestGroup(['prometheus', 'grafana', 'loki', 'alertmanager']);
  }

  async cmdPrometheus(): Promise<number> {
    return this.runSingleTest('prometheus');
  }

  async cmdGrafana(): Promise<number> {
    return this.runSingleTest('grafana');
  }

  async cmdLoki(): Promise<number> {
    return this.runSingleTest('loki');
  }

  async cmdAlertmanager(): Promise<number> {
    return this.runSingleTest('alertmanager');
  }

  private async runTestGroup(tests: SmokeTestName[]): Promise<number> {
    const results: SmokeResult[] = [];

    for (const name of tests) {
      const testFn = SMOKE_TESTS[name];
      const result = await testFn();
      results.push(result);

      if (!this.isJson()) {
        printResult(result);
      }
    }

    const report = createReport(results, {
      strict: this.isStrict(),
      warnAsError: this.isWarnAsError(),
    });

    if (this.isJson()) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSummary(report);
    }

    return report.exitCode;
  }

  private async runSingleTest(name: SmokeTestName): Promise<number> {
    const testFn = SMOKE_TESTS[name];
    const result = await testFn();
    const report = createReport([result], {
      strict: this.isStrict(),
      warnAsError: this.isWarnAsError(),
    });

    if (this.isJson()) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printResult(result);
    }

    return report.exitCode;
  }
}

// Run if executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  SmokeCommand.main();
}
