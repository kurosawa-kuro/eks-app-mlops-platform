/**
 * PreflightChecker - validates prerequisites before operations.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { c } from '../logging/colors.js';
import { run } from '../../infrastructure/shell/index.js';
import type { CheckResult } from '../types.js';

export class PreflightChecker {
  results: Record<string, unknown> = {};

  check(label: string, fn: () => CheckResult): unknown {
    process.stdout.write(`${label}... `);
    const result = fn();
    if (result.ok) {
      console.log(c.green('OK') + (result.detail ? ` (${result.detail})` : ''));
    } else {
      console.log(c.red('FAILED') + (result.detail ? ` (${result.detail})` : ''));
      if (result.error) {
        console.log(c.dim(`    Error: ${result.error}`));
      }
      if (result.hint) {
        console.log(c.yellow(`    Hint: ${result.hint}`));
      }
    }
    return result.ok ? result.value : null;
  }

  checkCommand(cmd: string, installHint = ''): boolean | null {
    return this.check(`Checking ${cmd}`, () => {
      try {
        execSync(`command -v ${cmd}`, { stdio: 'pipe' });
        return { ok: true, value: true };
      } catch {
        return {
          ok: false,
          detail: `${cmd} not found`,
          hint: installHint || `Install ${cmd} and ensure it's in PATH`,
        };
      }
    }) as boolean | null;
  }

  checkAwsCli(): boolean | null {
    return this.check('Checking AWS CLI', () => {
      try {
        run('which aws');
        return { ok: true, value: true };
      } catch {
        return {
          ok: false,
          detail: 'AWS CLI not found',
          hint: 'Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html',
        };
      }
    }) as boolean | null;
  }

  checkAwsCredentials(): boolean | null {
    return this.check('Checking AWS credentials', () => {
      try {
        const id = run('aws sts get-caller-identity --query Account --output text');
        return { ok: true, value: true, detail: `Account: ${id}` };
      } catch (e: unknown) {
        const error = e as Error;
        const errorMsg = error.message || String(e);
        let hint = 'Run: aws configure';
        if (errorMsg.includes('ExpiredToken')) {
          hint = 'Your AWS credentials have expired. Refresh with: aws sso login or aws configure';
        } else if (errorMsg.includes('InvalidClientTokenId')) {
          hint = 'Invalid AWS credentials. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY';
        } else if (errorMsg.includes('could not be found')) {
          hint = 'AWS profile not found. Check AWS_PROFILE or run: aws configure';
        }
        return {
          ok: false,
          detail: 'Credentials check failed',
          error: errorMsg.split('\n')[0],
          hint,
        };
      }
    }) as boolean | null;
  }

  checkPath(label: string, pathToCheck: string): boolean | null {
    return this.check(label, () => {
      try {
        if (!fs.existsSync(pathToCheck)) {
          return { ok: false, detail: 'Path does not exist', error: pathToCheck };
        }
        return { ok: true, value: true };
      } catch (e: unknown) {
        const error = e as Error;
        return { ok: false, detail: pathToCheck, error: error.message };
      }
    }) as boolean | null;
  }
}
