#!/usr/bin/env npx tsx
/**
 * Secrets Manager Management Script
 * Manage AWS Secrets Manager secrets: list, show, create, update, delete
 */

import * as fs from 'fs';
import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const { confirm, maskSecretValue } = lib;

class SecretsManage extends AwsCommand {
  static override name = 'secrets-manage';
  static service = 'secretsmanager';
  static override description = 'Secrets Manager Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List all secrets', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show secret details and value', args: '<secret-name>', aliases: ['get'], requireAws: true },
    create: { desc: 'Create a new secret', args: '<name> [value]', aliases: ['new'], requireAws: true },
    update: { desc: 'Update an existing secret', args: '<name> [value]', aliases: ['put'], requireAws: true },
    delete: { desc: 'Delete a secret (30-day recovery)', args: '<name>', aliases: ['rm'], requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--from-file': { name: 'fromFile', type: 'string', desc: 'Read secret value from file' },
    '--force': { name: 'force', type: 'boolean', desc: 'Permanently delete (no recovery)' },
    '--show-value': { name: 'showValue', type: 'boolean', desc: 'Show unmasked secret value' },
    '--description': { name: 'description', type: 'string', desc: 'Secret description' },
  };

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('Secrets Manager Secrets');

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const secrets = lib.secretsList(this.region);

    if (secrets.length === 0) {
      lib.log.info('No secrets found');
      return 0;
    }

    lib.log.pass(`Found ${secrets.length} secret(s)`);
    console.log('');

    console.log('  ' + 'NAME'.padEnd(40) + 'DESCRIPTION'.padEnd(30) + 'MODIFIED');
    console.log('  ' + '----'.padEnd(40) + '-----------'.padEnd(30) + '--------');

    for (const secret of secrets) {
      const name = (secret.Name || '').substring(0, 39).padEnd(40);
      const desc = (secret.Description || 'N/A').substring(0, 29).padEnd(30);
      const modified = secret.Modified ? lib.formatDate(secret.Modified) : 'N/A';
      console.log('  ' + name + desc + modified);
    }

    return 0;
  }

  async cmdShow(secretName?: string): Promise<number> {
    const showValue = this.options.showValue as boolean;

    if (!secretName) {
      lib.log.fail('Secret name is required');
      console.log('');
      console.log('Usage: node secrets-manage.js show <secret-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(secretName, 'secret'))) {
      return 1;
    }

    lib.log.header(`Secret: ${secretName}`);

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    if (!lib.secretsExists(secretName, this.region)) {
      lib.log.fail(`Secret '${secretName}' not found`);
      return 1;
    }

    // Get secret metadata
    const info = lib.secretsDescribe(secretName, this.region);
    if (!info) {
      lib.log.fail('Failed to get secret information');
      return 1;
    }

    lib.log.section('Secret Information');
    console.log(`  Name:        ${info.Name}`);
    console.log(`  ARN:         ${info.ARN}`);
    console.log(`  Description: ${info.Description || 'N/A'}`);
    console.log(`  Created:     ${lib.formatDate(info.CreatedDate)}`);
    console.log(`  Modified:    ${lib.formatDate(info.LastChangedDate)}`);

    // Get secret value
    const value = lib.secretsGetValue(secretName, this.region);

    lib.log.section('Secret Value');

    if (showValue) {
      // Show full value (dangerous!)
      lib.log.warn('Showing unmasked value:');
      console.log('');
      if (value && lib.isJson(value)) {
        try {
          console.log(JSON.stringify(JSON.parse(value), null, 2));
        } catch {
          console.log(value);
        }
      } else {
        console.log(value);
      }
    } else {
      // Show masked value
      if (value && lib.isJson(value)) {
        lib.log.info('Type: JSON');
        console.log('');
        const masked = maskSecretValue(value);
        masked.split('\n').forEach((line: string) => console.log(`    ${line}`));
      } else {
        lib.log.info('Type: String');
        console.log(`    ${maskSecretValue(value)}`);
      }
      console.log('');
      lib.log.info('Use --show-value to reveal the full secret');
    }

    // Usage hints
    console.log('');
    lib.log.info('SDK usage:');
    console.log(`  Python: client.get_secret_value(SecretId='${secretName}')`);
    console.log(`  Node:   client.getSecretValue({SecretId: '${secretName}'})`);

    return 0;
  }

  async cmdCreate(secretName?: string, secretValue?: string): Promise<number> {
    const { fromFile, description } = this.options as { fromFile?: string; description?: string };

    if (!secretName) {
      lib.log.fail('Secret name is required');
      console.log('');
      console.log('Usage: node secrets-manage.js create <name> <value>');
      return 1;
    }

    if (!this.validate(() => this.validateName(secretName, 'secret'))) {
      return 1;
    }

    // Handle --from-file
    if (fromFile) {
      try {
        lib.validateFileInput(fromFile, { maxSize: 64 * 1024 }); // 64KB max for secrets
        secretValue = fs.readFileSync(fromFile, 'utf-8');
        lib.log.info(`Reading secret from file: ${fromFile}`);
      } catch (e: unknown) {
        lib.log.fail(toError(e).message);
        return 1;
      }
    }

    if (!secretValue) {
      lib.log.fail('Secret value is required');
      console.log('');
      console.log('Usage: node secrets-manage.js create <name> <value>');
      console.log('       node secrets-manage.js create <name> --from-file <file>');
      return 1;
    }

    lib.log.header(`Create Secret: ${secretName}`);
    lib.log.info(`Region: ${this.region}`);

    // Determine type
    const isJson = lib.isJson(secretValue);
    lib.log.info(`Secret type: ${isJson ? 'JSON' : 'String'}`);

    // Show masked preview
    lib.log.info('Value preview:');
    const masked = maskSecretValue(secretValue);
    masked.split('\n').forEach((line: string) => console.log(`    ${line}`));
    console.log('');

    // Check if exists
    if (lib.secretsExists(secretName, this.region)) {
      lib.log.warn(`Secret '${secretName}' already exists`);

      const info = lib.secretsDescribe(secretName, this.region);
      if (info) {
        lib.log.info(`Created: ${lib.formatDate(info.CreatedDate)}`);
        lib.log.info(`Modified: ${lib.formatDate(info.LastChangedDate)}`);
      }

      const shouldUpdate = await confirm('Update existing secret?');
      if (!shouldUpdate) {
        lib.log.info('Cancelled');
        return 0;
      }

      // Update existing
      lib.log.section('Updating Secret');

      if (lib.secretsUpdate(secretName, secretValue, this.region)) {
        lib.log.pass('Secret updated');
      } else {
        lib.log.fail('Failed to update secret');
        return 1;
      }
    } else {
      // Create new
      lib.log.section('Creating Secret');

      try {
        const result = lib.secretsCreate(secretName, secretValue, this.region, description);
        lib.log.pass('Secret created');
        lib.log.info(`ARN: ${result.ARN}`);
      } catch (error: unknown) {
        lib.log.fail(`Failed to create secret: ${toError(error).message}`);
        return 1;
      }
    }

    // Summary
    console.log('');
    lib.log.pass('Secret operation completed!');
    console.log('');
    lib.log.info('Useful commands:');
    console.log(`  Show:   node secrets-manage.js show ${secretName}`);
    console.log(`  List:   node secrets-manage.js list`);
    console.log(`  Delete: node secrets-manage.js delete ${secretName}`);
    console.log('');
    lib.log.info('SDK usage:');
    console.log(`  Python: client.get_secret_value(SecretId='${secretName}')`);
    console.log(`  Node:   client.getSecretValue({SecretId: '${secretName}'})`);

    return 0;
  }

  async cmdUpdate(secretName?: string, secretValue?: string): Promise<number> {
    const { fromFile } = this.options as { fromFile?: string };

    if (!secretName) {
      lib.log.fail('Secret name is required');
      console.log('');
      console.log('Usage: node secrets-manage.js update <name> <value>');
      return 1;
    }

    if (!this.validate(() => this.validateName(secretName, 'secret'))) {
      return 1;
    }

    // Handle --from-file
    if (fromFile) {
      try {
        lib.validateFileInput(fromFile, { maxSize: 64 * 1024 }); // 64KB max for secrets
        secretValue = fs.readFileSync(fromFile, 'utf-8');
        lib.log.info(`Reading secret from file: ${fromFile}`);
      } catch (e: unknown) {
        lib.log.fail(toError(e).message);
        return 1;
      }
    }

    if (!secretValue) {
      lib.log.fail('Secret value is required');
      return 1;
    }

    lib.log.header(`Update Secret: ${secretName}`);

    if (!lib.secretsExists(secretName, this.region)) {
      lib.log.fail(`Secret '${secretName}' not found`);
      lib.log.info('Use "create" command to create a new secret');
      return 1;
    }

    // Show current info
    const info = lib.secretsDescribe(secretName, this.region);
    if (info) {
      lib.log.info(`Current Modified: ${lib.formatDate(info.LastChangedDate)}`);
    }

    // Update
    lib.log.section('Updating Secret');

    if (lib.secretsUpdate(secretName, secretValue, this.region)) {
      lib.log.pass('Secret updated');
      return 0;
    } else {
      lib.log.fail('Failed to update secret');
      return 1;
    }
  }

  async cmdDelete(secretName?: string): Promise<number> {
    const forceDelete = this.options.force as boolean;

    if (!secretName) {
      lib.log.fail('Secret name is required');
      console.log('');
      console.log('Usage: node secrets-manage.js delete <name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(secretName, 'secret'))) {
      return 1;
    }

    lib.log.header(`Delete Secret: ${secretName}`);

    if (!lib.secretsExists(secretName, this.region)) {
      lib.log.warn(`Secret '${secretName}' does not exist`);
      return 0;
    }

    lib.log.warn('This will schedule the secret for deletion');

    if (forceDelete) {
      lib.log.warn('Force delete: Secret will be immediately deleted (unrecoverable)');
    } else {
      lib.log.info('Secret will be recoverable for 30 days');
    }

    const shouldDelete = await confirm(`Delete secret '${secretName}'?`);
    if (!shouldDelete) {
      lib.log.info('Cancelled');
      return 0;
    }

    if (lib.secretsDelete(secretName, this.region, forceDelete)) {
      lib.log.pass('Secret deleted');
      return 0;
    } else {
      lib.log.fail('Failed to delete secret');
      return 1;
    }
  }
}

SecretsManage.main();
