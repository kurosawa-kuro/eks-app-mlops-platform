/**
 * AwsCommand - Base class for AWS service management scripts
 *
 * Extends InfraCommand with AWS-specific utilities:
 * - awsJson(): Execute AWS CLI and parse JSON response
 * - validateName(): Validate resource names (prevent injection)
 * - validateEmail(): Validate email format
 * - awsExec(): Execute AWS CLI with error handling
 *
 * Usage:
 *   class MyAwsCommand extends AwsCommand {
 *     static name = 'my-command';
 *     static service = 'service-name';  // e.g., 's3', 'firehose'
 *     static commands = { ... };
 *   }
 *   MyAwsCommand.main();
 */

import { InfraCommand, lib } from './InfraCommand.js';
import { toError } from '../../infrastructure/types.js';

const { validateResourceName } = lib;

export interface ListPatternConfig {
  title: string;
  listFn: () => unknown[];
  formatFn: (item: unknown) => string[];
  headers: string[];
  widths: number[];
  emptyMessage?: string;
}

export interface ShowPatternConfig {
  resourceId: string | undefined;
  resourceType: string;
  usage: string;
  existsFn?: (id: string) => boolean;
  displayFn: (id: string) => Promise<void>;
}

export interface CreatePatternConfig {
  resourceId: string | undefined;
  resourceType: string;
  usage: string;
  existsFn?: (id: string) => boolean;
  createFn: (id: string) => Promise<void>;
  successFn?: (id: string) => Promise<void>;
  allowExisting?: boolean;
}

export class AwsCommand extends InfraCommand {
  // Override in subclass
  static service = 'aws';

  // ============================================================
  // AWS CLI Helpers
  // ============================================================

  /**
   * Execute AWS CLI command and return parsed JSON.
   * When ignoreError is true, returns defaultValue (or null) on error.
   */
  awsJson<T>(cmd: string, options: { ignoreError: true; defaultValue: T }): T;
  awsJson<T>(cmd: string, options: { ignoreError: true }): T | null;
  awsJson<T>(cmd: string, options?: { ignoreError?: false }): T;
  awsJson<T = unknown>(cmd: string, options: { ignoreError?: boolean; defaultValue?: T } = {}): T | null {
    const { ignoreError = false, defaultValue } = options;
    const fullCmd = `aws ${cmd} --region ${this.region} --output json`;

    try {
      const result = lib.run(fullCmd, { ignoreError: false, silent: true });
      return JSON.parse(result) as T;
    } catch (e: unknown) {
      if (ignoreError) return defaultValue ?? null;
      throw new Error(`AWS command failed: ${cmd} (${toError(e).message})`);
    }
  }

  /**
   * Execute AWS CLI command (no JSON parsing)
   */
  awsExec(cmd: string, options: { ignoreError?: boolean; defaultValue?: string } = {}): string {
    const { ignoreError = false, defaultValue = '' } = options;
    const fullCmd = `aws ${cmd} --region ${this.region}`;

    try {
      return lib.run(fullCmd, { ignoreError: false, silent: true });
    } catch (e: unknown) {
      if (ignoreError) return defaultValue;
      throw new Error(`AWS command failed: ${cmd} (${toError(e).message})`);
    }
  }

  /**
   * Execute AWS CLI with JSON input.
   * When ignoreError is true, returns defaultValue (or null) on error.
   */
  awsJsonInput<T>(cmd: string, config: Record<string, unknown>, options: { ignoreError: true; defaultValue: T }): T;
  awsJsonInput<T>(cmd: string, config: Record<string, unknown>, options: { ignoreError: true }): T | null;
  awsJsonInput<T>(cmd: string, config: Record<string, unknown>, options?: { ignoreError?: false }): T;
  awsJsonInput<T = unknown>(
    cmd: string,
    config: Record<string, unknown>,
    options: { ignoreError?: boolean; defaultValue?: T } = {}
  ): T | null {
    const { ignoreError = false, defaultValue } = options;
    const jsonStr = JSON.stringify(config);
    const fullCmd = `aws ${cmd} --cli-input-json '${jsonStr}' --region ${this.region} --output json`;

    try {
      const result = lib.run(fullCmd, { ignoreError: false, silent: true });
      return JSON.parse(result) as T;
    } catch (e: unknown) {
      if (ignoreError) return defaultValue ?? null;
      throw new Error(`AWS command failed: ${cmd} (${toError(e).message})`);
    }
  }

  // ============================================================
  // Validation Helpers
  // ============================================================

  /**
   * Validate resource name (throws on invalid)
   */
  validateName(name: string | undefined, type: string): string {
    return validateResourceName(name, type);
  }

  /**
   * Validate multiple resource names
   */
  validateNames(...items: Array<[string | undefined, string]>): boolean {
    for (const [name, type] of items) {
      validateResourceName(name, type);
    }
    return true;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string | undefined): string {
    if (!email || typeof email !== 'string' || !/^[^\s]+@[^\s]+\.[^\s]+$/.test(email)) {
      throw new Error('Invalid email format');
    }
    return email;
  }

  /**
   * Safe validation wrapper - returns false instead of throwing
   */
  validate(validateFn: () => void): boolean {
    try {
      validateFn();
      return true;
    } catch (e: unknown) {
      lib.log.fail(toError(e).message);
      return false;
    }
  }

  // ============================================================
  // Display Helpers
  // ============================================================

  /**
   * Show service and region info
   */
  showServiceInfo(): void {
    const ctor = this.constructor as typeof AwsCommand;
    lib.log.info(`Service: ${ctor.service}`);
    lib.log.info(`Region: ${this.region}`);
    console.log('');
  }

  /**
   * Format table helper (re-export)
   */
  formatTable(headers: string[], rows: string[][], widths: number[]): void {
    lib.formatTable(headers, rows, widths);
  }

  // ============================================================
  // Common Patterns
  // ============================================================

  /**
   * Standard list command pattern
   */
  async listPattern(config: ListPatternConfig): Promise<number> {
    const { title, listFn, formatFn, headers, widths, emptyMessage = 'No items found' } = config;

    lib.log.header(title);
    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const items = listFn();

    if (!items || items.length === 0) {
      lib.log.info(emptyMessage);
      return 0;
    }

    lib.log.pass(`Found ${items.length} item(s)`);
    console.log('');

    const rows = items.map(formatFn);
    this.formatTable(headers, rows, widths);

    return 0;
  }

  /**
   * Standard show command pattern with validation
   */
  async showPattern(config: ShowPatternConfig): Promise<number> {
    const { resourceId, resourceType, usage, existsFn, displayFn } = config;

    if (!resourceId) {
      lib.log.fail(`${resourceType} is required`);
      console.log('');
      console.log(usage);
      return 1;
    }

    if (!this.validate(() => this.validateName(resourceId, resourceType))) {
      return 1;
    }

    lib.log.header(`${resourceType}: ${resourceId}`);

    if (existsFn && !existsFn(resourceId)) {
      lib.log.fail(`${resourceType} '${resourceId}' not found`);
      return 1;
    }

    await displayFn(resourceId);
    return 0;
  }

  /**
   * Standard create command pattern with validation and duplicate check
   */
  async createPattern(config: CreatePatternConfig): Promise<number> {
    const { resourceId, resourceType, usage, existsFn, createFn, successFn, allowExisting = true } = config;

    if (!resourceId) {
      lib.log.fail(`${resourceType} is required`);
      console.log('');
      console.log(usage);
      return 1;
    }

    if (!this.validate(() => this.validateName(resourceId, resourceType))) {
      return 1;
    }

    lib.log.header(`Create ${resourceType}: ${resourceId}`);
    lib.log.info(`Region: ${this.region}`);
    console.log('');

    // Check if exists
    if (existsFn && existsFn(resourceId)) {
      if (allowExisting) {
        lib.log.warn(`${resourceType} '${resourceId}' already exists`);
        return 0;
      }
      lib.log.fail(`${resourceType} '${resourceId}' already exists`);
      return 1;
    }

    // Create
    lib.log.section(`Creating ${resourceType}`);
    try {
      await createFn(resourceId);
      lib.log.pass(`${resourceType} created`);

      if (successFn) {
        await successFn(resourceId);
      }
      return 0;
    } catch (e: unknown) {
      lib.log.fail(`Failed to create ${resourceType}: ${toError(e).message}`);
      return 1;
    }
  }
}

export { lib };
