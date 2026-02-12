#!/usr/bin/env npx tsx
/**
 * Prerequisites Check & Install Script
 * Check and install required tools for EKS deployment
 *
 * Usage:
 *   npx tsx prerequisites.ts check    # Check prerequisites
 *   npx tsx prerequisites.ts install  # Install missing tools
 *   npx tsx prerequisites.ts --help   # Show help
 */

import { execSync, spawnSync } from 'child_process';
import { c } from '../../framework/logging/colors.js';
import { log } from '../../framework/logging/logger.js';

// ============================================================
// CLI Parser
// ============================================================
interface CLIOptions {
  command: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  if (command === '--help' || command === '-h' || command === 'help') {
    showHelp();
    process.exit(0);
  }

  return { command };
}

function showHelp(): void {
  console.log(`
${c.bold('Prerequisites Check Tool')}

${c.bold('Usage:')}
  npx tsx prerequisites.ts [command]

${c.bold('Commands:')}
  check     Check if prerequisites are installed (default)
  install   Install missing prerequisites (SSM plugin)

${c.bold('Prerequisites:')}
  - AWS CLI
  - SSM Session Manager Plugin
`);
}

// ============================================================
// Check Functions
// ============================================================
interface CheckResult {
  name: string;
  installed: boolean;
  version?: string;
  installCmd?: string;
}

function checkAwsCli(): CheckResult {
  try {
    const result = spawnSync('aws', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) {
      const version = result.stdout.trim() || result.stderr.trim();
      return { name: 'AWS CLI', installed: true, version };
    }
  } catch {
    // Not installed
  }
  return {
    name: 'AWS CLI',
    installed: false,
    installCmd: 'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip" && unzip /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install',
  };
}

function checkSsmPlugin(): CheckResult {
  try {
    const result = spawnSync('session-manager-plugin', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) {
      const version = result.stdout.trim();
      return { name: 'SSM Session Manager Plugin', installed: true, version };
    }
  } catch {
    // Not installed
  }
  return {
    name: 'SSM Session Manager Plugin',
    installed: false,
    installCmd: 'curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "/tmp/session-manager-plugin.deb" && sudo dpkg -i /tmp/session-manager-plugin.deb',
  };
}

// ============================================================
// Install Function
// ============================================================
function installSsmPlugin(): boolean {
  log.info('Installing SSM Session Manager Plugin...');

  try {
    // Download
    log.info('Downloading session-manager-plugin.deb...');
    execSync(
      'curl -s "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "/tmp/session-manager-plugin.deb"',
      { stdio: 'inherit' }
    );

    // Install
    log.info('Installing (requires sudo)...');
    execSync('sudo dpkg -i /tmp/session-manager-plugin.deb', { stdio: 'inherit' });

    // Verify
    const result = spawnSync('session-manager-plugin', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) {
      log.pass(`Installed: ${result.stdout.trim()}`);
      return true;
    }
  } catch (err) {
    log.fail(`Installation failed: ${(err as Error).message}`);
  }
  return false;
}

// ============================================================
// Main
// ============================================================
async function runCheck(): Promise<boolean> {
  log.section('Prerequisites Check');

  const checks = [checkAwsCli(), checkSsmPlugin()];
  let allInstalled = true;

  for (const check of checks) {
    if (check.installed) {
      log.pass(`${check.name}: ${check.version}`);
    } else {
      log.fail(`${check.name}: Not installed`);
      if (check.installCmd) {
        console.log(c.dim(`    Install: ${check.installCmd}`));
      }
      allInstalled = false;
    }
  }

  return allInstalled;
}

async function runInstall(): Promise<boolean> {
  log.section('Prerequisites Install');

  // Check AWS CLI first
  const awsCheck = checkAwsCli();
  if (!awsCheck.installed) {
    log.fail('AWS CLI is not installed. Please install it first:');
    console.log(c.dim(`  ${awsCheck.installCmd}`));
    return false;
  }
  log.pass(`AWS CLI: ${awsCheck.version}`);

  // Check and install SSM plugin
  const ssmCheck = checkSsmPlugin();
  if (ssmCheck.installed) {
    log.pass(`SSM Plugin: ${ssmCheck.version} (already installed)`);
    return true;
  }

  return installSsmPlugin();
}

async function main(): Promise<void> {
  const CLI = parseArgs();

  console.log(c.bold('\n=== Prerequisites ===\n'));

  let success = true;

  switch (CLI.command) {
    case 'check':
      success = await runCheck();
      break;
    case 'install':
      success = await runInstall();
      break;
    default:
      log.fail(`Unknown command: ${CLI.command}`);
      showHelp();
      process.exit(1);
  }

  console.log('');
  if (success) {
    log.pass('All prerequisites satisfied');
  } else {
    log.fail('Some prerequisites missing');
    console.log(c.dim('\nRun: make eks-prereq-install'));
    process.exit(1);
  }
}

// ESM module guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(c.red('Error:'), err);
    process.exit(1);
  });
}
