/**
 * InfraCommand - Base class for infrastructure CLI scripts
 *
 * Provides:
 * - Declarative command definitions
 * - Auto-generated help
 * - Standardized preflight checks
 * - Unified error handling
 * - CLI argument parsing
 *
 * Usage:
 *   class MyCommand extends InfraCommand {
 *     static name = 'my-command';
 *     static description = 'My command description';
 *     static commands = {
 *       list: { desc: 'List items', aliases: ['ls'] },
 *       show: { desc: 'Show details', args: '<name>', requireAws: true },
 *     };
 *     async cmdList() { ... }
 *     async cmdShow(name: string) { ... }
 *   }
 *   MyCommand.main();
 */

// Core - Foundation utilities
import { colors, c } from '../logging/colors.js';
import { log } from '../logging/logger.js';
import { run, aws, sleep, runStreaming } from '../../infrastructure/shell/exec.js';

// Utils - Utility functions
import { formatBytes, formatDate } from '../utils/index.js';
import { isJson, maskPassword, maskToken, maskSecretValue } from '../utils/index.js';
import {
  validateResourceName,
  validateInstanceId,
  validatePort,
  validateOverlayName,
  validateStepArg,
  validateCommand,
  validateFileInput,
  escapeSedReplacement,
} from '../utils/index.js';
import { confirm, formatTable } from '../utils/index.js';

// AWS - AWS service utilities
import { awsGetRegion, awsGetAccountId } from '../../infrastructure/aws/api/core.js';
import {
  ecrGetRegistryUrl,
  ecrDockerLogin,
  ecrListRepositories,
  ecrRepositoryExists,
  ecrCreateRepository,
  ecrListImages,
  ecrSetLifecyclePolicy,
} from '../../infrastructure/aws/api/ecr.js';
import { eksUpdateKubeconfig, eksGetClusterInfo } from '../../infrastructure/aws/api/eks.js';
import {
  s3BucketExists,
  s3ListBuckets,
  s3CreateBucket,
  s3BlockPublicAccess,
  s3EnableVersioning,
  s3GetBucketInfo,
  s3ListObjects,
  s3UploadString,
} from '../../infrastructure/aws/api/s3.js';
import {
  secretsList,
  secretsExists,
  secretsDescribe,
  secretsGetValue,
  secretsCreate,
  secretsUpdate,
  secretsDelete,
} from '../../infrastructure/aws/api/secrets.js';

// Terraform
import { terraformOutput, createTerraformOutputs } from '../../infrastructure/terraform/outputs.js';

// Classes - Utility classes
import { PreflightChecker } from '../lifecycle/PreflightChecker.js';
import { Poller } from '../lifecycle/Poller.js';
import { HTTPSVerifier } from '../lifecycle/HTTPSVerifier.js';
import { CommandBuilder } from './CommandBuilder.js';
import { SSMCommandRunner, ssmGetInstanceStatus } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { S3Uploader } from '../../infrastructure/aws/operations/S3Uploader.js';

// Errors
import { InfraError } from '../errors/InfraError.js';
import { withRetry } from '../errors/retry.js';

// Narrative Framework
import { showNextSteps, NEXT_STEPS } from '../narrative/next-steps.js';
import {
  showContext,
  buildContextConfig,
  showPreflightSummary,
  createPreflightResult,
  showOutcome,
  showSimpleOutcome,
  CONTEXT_TEMPLATES,
} from '../narrative/index.js';

// Kubernetes
import {
  ClusterMonitor,
  NodeGroupMonitor,
  ASGMonitor,
  BastionMonitor,
} from '../../infrastructure/kubernetes/index.js';
import {
  renderManifest,
  renderManifestWithInfo,
  renderInline,
  templateExists,
  getTemplatesDir,
  joinManifests,
  TEMPLATES,
} from '../../infrastructure/kubernetes/manifest/index.js';
import { ManifestDeployer, HelmDeployer } from '../../infrastructure/kubernetes/index.js';

// Types
import type { CommandDefinition, OptionDefinition } from '../types.js';

// Aggregate lib object for backward compatibility
const lib = {
  // Core
  colors, c, log, run, aws, sleep, runStreaming,
  // Utils
  formatBytes, formatDate, isJson, maskPassword, maskToken, maskSecretValue,
  validateResourceName, validateInstanceId, validatePort, validateOverlayName,
  validateStepArg, validateCommand, validateFileInput, escapeSedReplacement,
  confirm, formatTable,
  // AWS
  awsGetRegion, awsGetAccountId,
  ecrGetRegistryUrl, ecrDockerLogin, ecrListRepositories, ecrRepositoryExists,
  ecrCreateRepository, ecrListImages, ecrSetLifecyclePolicy,
  eksUpdateKubeconfig, eksGetClusterInfo,
  s3BucketExists, s3ListBuckets, s3CreateBucket, s3BlockPublicAccess,
  s3EnableVersioning, s3GetBucketInfo, s3ListObjects, s3UploadString,
  secretsList, secretsExists, secretsDescribe, secretsGetValue,
  secretsCreate, secretsUpdate, secretsDelete,
  // Terraform
  terraformOutput, createTerraformOutputs,
  // Classes
  PreflightChecker, Poller, HTTPSVerifier, CommandBuilder,
  SSMCommandRunner, ssmGetInstanceStatus, S3Uploader,
  // Errors
  InfraError, withRetry,
  // Narrative
  showNextSteps, NEXT_STEPS,
  showContext, buildContextConfig, showPreflightSummary, createPreflightResult,
  showOutcome, showSimpleOutcome, CONTEXT_TEMPLATES,
  // Kubernetes
  ClusterMonitor, NodeGroupMonitor, ASGMonitor, BastionMonitor,
  renderManifest, renderManifestWithInfo, renderInline, templateExists,
  getTemplatesDir, joinManifests, TEMPLATES,
  ManifestDeployer, HelmDeployer,
};

export interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
}

export interface ResolvedCommand {
  name: string;
  def: CommandDefinition;
}

export class InfraCommand {
  // Override in subclass
  static name = 'command';
  static description = 'Command description';
  static commands: Record<string, CommandDefinition> = {};
  static options: Record<string, OptionDefinition> = {};

  preflight: PreflightChecker;
  region: string;
  args: string[];
  options: Record<string, string | boolean>;

  constructor() {
    this.preflight = new PreflightChecker();
    this.region = awsGetRegion();
    this.args = [];
    this.options = {};
  }

  // ============================================================
  // Preflight Checks
  // ============================================================

  requireAws(): boolean | null {
    return this.preflight.checkAwsCli() && this.preflight.checkAwsCredentials();
  }

  requireDocker(): boolean | null {
    return this.preflight.checkCommand('docker', 'https://docs.docker.com/get-docker/');
  }

  // ============================================================
  // CLI Parsing
  // ============================================================

  parseArgs(): ParsedArgs {
    const argv = process.argv.slice(2);
    const command = argv[0] || 'help';
    const args: string[] = [];
    const options: Record<string, string | boolean> = {};

    // Get static properties from the actual class
    const ctor = this.constructor as typeof InfraCommand;

    // Parse options and positional args
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];

      // Common flags
      if (arg === '--help' || arg === '-h') {
        return { command: 'help', args: [], options: {} };
      }

      // Handle --key=value format
      if (arg.includes('=') && arg.startsWith('-')) {
        const eqIndex = arg.indexOf('=');
        const key = arg.substring(0, eqIndex);
        const value = arg.substring(eqIndex + 1);
        const optDef = ctor.options[key];
        if (optDef) {
          options[optDef.name] = optDef.type === 'boolean' ? value !== 'false' : value;
        }
        continue;
      }

      // Check static options definition (--key value format)
      const optDef = ctor.options[arg];
      if (optDef) {
        if (optDef.type === 'boolean') {
          options[optDef.name] = true;
        } else {
          options[optDef.name] = argv[++i];
        }
        continue;
      }

      // Collect positional args
      if (!arg.startsWith('-')) {
        args.push(arg);
      }
    }

    return { command, args, options };
  }

  // ============================================================
  // Command Routing
  // ============================================================

  resolveCommand(commandName: string): ResolvedCommand | null {
    const ctor = this.constructor as typeof InfraCommand;
    const commands = ctor.commands;

    // Direct match
    if (commands[commandName]) {
      return { name: commandName, def: commands[commandName] };
    }

    // Alias match
    for (const [name, def] of Object.entries(commands)) {
      if (def.aliases?.includes(commandName)) {
        return { name, def };
      }
    }

    return null;
  }

  async run(): Promise<number> {
    const { command, args, options } = this.parseArgs();
    this.args = args;
    this.options = options;

    const ctor = this.constructor as typeof InfraCommand;

    // Help command
    if (command === 'help' || command === '--help' || command === '-h') {
      this.showHelp();
      return 0;
    }

    // Resolve command
    const resolved = this.resolveCommand(command);
    if (!resolved) {
      log.fail(`Unknown command: ${command}`);
      console.log('');
      console.log(`Run "node ${ctor.name}.js help" for usage`);
      return 1;
    }

    const { name, def } = resolved;

    // Preflight checks based on command requirements
    if (def.requireAws && !this.requireAws()) return 1;
    if (def.requireDocker && !this.requireDocker()) return 1;

    // Build handler name (convert kebab-case to PascalCase: push-public -> PushPublic)
    const toPascalCase = (str: string) => str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    const handlerName = def.handler || `cmd${toPascalCase(name)}`;
    const handler = (this as unknown as Record<string, (...args: string[]) => Promise<number>>)[handlerName];

    if (typeof handler !== 'function') {
      log.fail(`Handler not implemented: ${handlerName}`);
      return 1;
    }

    // Call handler with positional args spread
    return handler.call(this, ...args);
  }

  // ============================================================
  // Help Generation
  // ============================================================

  showHelp(): void {
    const ctor = this.constructor as typeof InfraCommand;
    const { name, description, commands, options } = ctor;

    console.log(`
${description}

Usage:
  node ${name}.js <command> [options]

Commands:`);

    // Calculate padding
    const maxCmdLen = Math.max(...Object.entries(commands).map(([n, d]) => {
      const argsStr = d.args || '';
      return `${n} ${argsStr}`.length;
    }));

    // Print commands
    for (const [cmdName, def] of Object.entries(commands)) {
      const argsStr = def.args || '';
      const cmdStr = `${cmdName} ${argsStr}`.padEnd(maxCmdLen + 2);
      const aliasStr = def.aliases ? ` (aliases: ${def.aliases.join(', ')})` : '';
      console.log(`  ${cmdStr} ${def.desc}${aliasStr}`);
    }
    console.log(`  ${'help'.padEnd(maxCmdLen + 2)} Show this help message`);

    // Print options if any
    if (Object.keys(options).length > 0) {
      console.log('\nOptions:');
      for (const [flag, opt] of Object.entries(options)) {
        const typeStr = opt.type === 'string' ? ` <${opt.name}>` : '';
        console.log(`  ${flag}${typeStr}`.padEnd(25) + (opt.desc || ''));
      }
    }

    // Environment variables
    console.log(`
Environment Variables:
  AWS_REGION    AWS region (default: ap-northeast-1)
  AWS_PROFILE   AWS profile to use
`);
  }

  // ============================================================
  // Entry Point
  // ============================================================

  static main(): void {
    const instance = new this();
    instance.run()
      .then((code) => process.exit(code || 0))
      .catch((error: Error) => {
        log.fail(error.message);
        process.exit(1);
      });
  }
}

// Re-export lib for convenience
export { lib };
